package com.snapcontact.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class ScreenCaptureManager(private val context: Context) {
  companion object {
    private const val TAG = "ScreenCaptureManager"
    private const val VIRTUAL_DISPLAY_NAME = "SnapContact_QuickCapture"
    private const val TIMEOUT_MS = 3000L
  }

  suspend fun captureFrame(mediaProjection: MediaProjection): Bitmap? = suspendCancellableCoroutine { continuation ->
    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    windowManager.defaultDisplay.getRealMetrics(metrics)

    val width = metrics.widthPixels
    val height = metrics.heightPixels
    val density = metrics.densityDpi

    val imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    val mainHandler = Handler(Looper.getMainLooper())

    var virtualDisplay: VirtualDisplay? = null
    var hasCaptured = false

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
          hasCaptured = true
          mainHandler.removeCallbacks(timeoutRunnable)

          val planes = image.planes
          val buffer = planes[0].buffer
          val pixelStride = planes[0].pixelStride
          val rowStride = planes[0].rowStride
          val rowPadding = rowStride - pixelStride * width

          val bitmap = Bitmap.createBitmap(
            width + rowPadding / pixelStride,
            height,
            Bitmap.Config.ARGB_8888
          )
          bitmap.copyPixelsFromBuffer(buffer)

          val finalBitmap = if (rowPadding == 0) {
            bitmap
          } else {
            val cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height)
            bitmap.recycle()
            cropped
          }

          cleanup()
          Log.d(TAG, "Frame captured successfully (${finalBitmap.width}x${finalBitmap.height})")
          if (continuation.isActive) continuation.resume(finalBitmap)
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
}
