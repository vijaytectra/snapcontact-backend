package com.snapcontact.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import kotlinx.coroutines.suspendCancellableCoroutine
import java.nio.ByteBuffer
import kotlin.coroutines.resume

class ScreenCaptureManager(private val context: Context) {
  companion object {
    private const val TAG = "ScreenCaptureManager"
    private const val VIRTUAL_DISPLAY_NAME = "SnapContact_QuickCapture"
    private const val TIMEOUT_MS = 4000L
  }

  suspend fun captureFrame(mediaProjection: MediaProjection): Bitmap? = suspendCancellableCoroutine { continuation ->
    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val width: Int
    val height: Int
    val density: Int
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bounds = windowManager.currentWindowMetrics.bounds
      width = bounds.width()
      height = bounds.height()
      density = context.resources.configuration.densityDpi
    } else {
      val metrics = DisplayMetrics()
      @Suppress("DEPRECATION")
      windowManager.defaultDisplay.getRealMetrics(metrics)
      width = metrics.widthPixels
      height = metrics.heightPixels
      density = metrics.densityDpi
    }

    val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    val mainHandler = Handler(Looper.getMainLooper())

    var virtualDisplay: VirtualDisplay? = null
    var hasCaptured = false
    var frameCount = 0

    lateinit var projectionCallback: MediaProjection.Callback

    fun cleanup() {
      try {
        mediaProjection.unregisterCallback(projectionCallback)
      } catch (e: Exception) {
        // Unregister safe
      }
      try {
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader.close()
      } catch (e: Exception) {
        Log.e(TAG, "Error cleaning up screen capture resources", e)
      }
    }

    projectionCallback = object : MediaProjection.Callback() {
      override fun onStop() {
        Log.w(TAG, "MediaProjection was stopped or revoked by Android")
        cleanup()
        if (continuation.isActive) continuation.resume(null)
      }
    }
    mediaProjection.registerCallback(projectionCallback, mainHandler)

    continuation.invokeOnCancellation {
      cleanup()
    }

    val timeoutRunnable = Runnable {
      if (!hasCaptured && continuation.isActive) {
        Log.w(TAG, "Screen capture frame timed out after ${TIMEOUT_MS}ms")
        cleanup()
        continuation.resume(null)
      }
    }
    mainHandler.postDelayed(timeoutRunnable, TIMEOUT_MS)

    imageReader.setOnImageAvailableListener({ reader ->
      if (hasCaptured) return@setOnImageAvailableListener
      var image: Image? = null
      try {
        image = reader.acquireLatestImage()
        if (image != null) {
          frameCount++
          val planes = image.planes
          val buffer = planes[0].buffer
          val pixelStride = planes[0].pixelStride
          val rowStride = planes[0].rowStride
          val rowBytes = width * pixelStride

          val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          val cleanBuffer = ByteBuffer.allocateDirect(width * height * 4)
          val rowData = ByteArray(rowBytes)
          buffer.rewind()
          for (row in 0 until height) {
            buffer.position(row * rowStride)
            buffer.get(rowData, 0, rowBytes)
            cleanBuffer.put(rowData, 0, rowBytes)
          }
          cleanBuffer.rewind()
          bitmap.copyPixelsFromBuffer(cleanBuffer)

          // On some devices the initial frame can be blank / uninitialized during display attachment.
          // Discard up to 2 initial blank frames so the real screen content is captured.
          if (frameCount < 3 && isBitmapBlank(bitmap)) {
            Log.d(TAG, "Frame $frameCount is blank, waiting for next display update")
            bitmap.recycle()
            return@setOnImageAvailableListener
          }

          hasCaptured = true
          mainHandler.removeCallbacks(timeoutRunnable)
          cleanup()
          Log.d(TAG, "Frame captured successfully on frame $frameCount (${bitmap.width}x${bitmap.height})")
          if (continuation.isActive) continuation.resume(bitmap)
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed reading image frame from ImageReader", e)
        mainHandler.removeCallbacks(timeoutRunnable)
        cleanup()
        if (continuation.isActive) continuation.resume(null)
      } finally {
        try {
          image?.close()
        } catch (e: Exception) {
          Log.e(TAG, "Error closing Image object", e)
        }
      }
    }, mainHandler)

    try {
      virtualDisplay = mediaProjection.createVirtualDisplay(
        VIRTUAL_DISPLAY_NAME,
        width,
        height,
        density,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        imageReader.surface,
        null,
        mainHandler
      )
    } catch (e: Exception) {
      Log.e(TAG, "Failed creating VirtualDisplay", e)
      mainHandler.removeCallbacks(timeoutRunnable)
      cleanup()
      if (continuation.isActive) continuation.resume(null)
    }
  }

  private fun isBitmapBlank(bitmap: Bitmap): Boolean {
    val w = bitmap.width
    val h = bitmap.height
    for (xStep in 1..4) {
      for (yStep in 1..4) {
        val pixel = bitmap.getPixel((w * xStep) / 5, (h * yStep) / 5)
        val alpha = (pixel shr 24) and 0xff
        val red = (pixel shr 16) and 0xff
        val green = (pixel shr 8) and 0xff
        val blue = pixel and 0xff
        if (alpha > 0 && (red > 8 || green > 8 || blue > 8)) {
          return false
        }
      }
    }
    return true
  }
}
