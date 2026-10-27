package com.snapcontact.capture

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class QuickCaptureOverlay(
  private val context: Context,
  private val onCaptureClicked: () -> Unit
) {
  companion object {
    private const val TAG = "QuickCaptureOverlay"
    private const val BUTTON_SIZE_DP = 56
    private const val CLICK_THRESHOLD_DP = 10
  }

  private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private var overlayView: FrameLayout? = null
  private var layoutParams: WindowManager.LayoutParams? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  private val density = context.resources.displayMetrics.density
  private val buttonSizePx = (BUTTON_SIZE_DP * density).toInt()
  private val clickThresholdPx = (CLICK_THRESHOLD_DP * density)

  val isShowing: Boolean
    get() = overlayView != null

  fun show() {
    mainHandler.post {
      if (overlayView != null) return@post

      val displayMetrics = context.resources.displayMetrics
      val screenWidth = displayMetrics.widthPixels
      val screenHeight = displayMetrics.heightPixels

      val params = WindowManager.LayoutParams(
        buttonSizePx,
        buttonSizePx,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT
      ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = screenWidth - buttonSizePx - (8 * density).toInt()
        y = (screenHeight * 0.4f).toInt()
      }
      layoutParams = params

      val container = FrameLayout(context).apply {
        layoutParams = FrameLayout.LayoutParams(buttonSizePx, buttonSizePx)
      }

      val button = FloatingCaptureButtonView(context).apply {
        layoutParams = FrameLayout.LayoutParams(buttonSizePx, buttonSizePx)
      }
      container.addView(button)

      var initialX = 0
      var initialY = 0
      var initialTouchX = 0f
      var initialTouchY = 0f
      var isDragging = false
      var lastClickTime = 0L

      container.setOnTouchListener { _, event ->
        val currentParams = layoutParams ?: return@setOnTouchListener false
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            initialX = currentParams.x
            initialY = currentParams.y
            initialTouchX = event.rawX
            initialTouchY = event.rawY
            isDragging = false
            true
          }
          MotionEvent.ACTION_MOVE -> {
            val deltaX = event.rawX - initialTouchX
            val deltaY = event.rawY - initialTouchY
            if (!isDragging && (abs(deltaX) > clickThresholdPx || abs(deltaY) > clickThresholdPx)) {
              isDragging = true
            }
            if (isDragging) {
              val currentDisplay = context.resources.displayMetrics
              currentParams.x = (initialX + deltaX).toInt()
              val minY = (24 * density).toInt()
              val maxY = currentDisplay.heightPixels - buttonSizePx - (40 * density).toInt()
              currentParams.y = max(minY, min(maxY, (initialY + deltaY).toInt()))
              try {
                windowManager.updateViewLayout(container, currentParams)
              } catch (e: Exception) {
                Log.e(TAG, "Error updating overlay drag layout", e)
              }
            }
            true
          }
          MotionEvent.ACTION_UP -> {
            if (!isDragging) {
              val now = System.currentTimeMillis()
              if (now - lastClickTime > 1200L) {
                lastClickTime = now
                Log.d(TAG, "Floating button clicked")
                onCaptureClicked()
              }
            } else {
              // Snap to nearest edge (left or right)
              val currentDisplay = context.resources.displayMetrics
              val snapRight = currentParams.x > (currentDisplay.widthPixels / 2 - buttonSizePx / 2)
              currentParams.x = if (snapRight) {
                currentDisplay.widthPixels - buttonSizePx - (8 * density).toInt()
              } else {
                (8 * density).toInt()
              }
              try {
                windowManager.updateViewLayout(container, currentParams)
              } catch (e: Exception) {
                Log.e(TAG, "Error snapping overlay to edge", e)
              }
            }
            true
          }
          else -> false
        }
      }

      try {
        windowManager.addView(container, params)
        overlayView = container
        Log.d(TAG, "QuickCapture overlay added to WindowManager")
      } catch (e: Exception) {
        Log.e(TAG, "Failed to add QuickCapture overlay view", e)
      }
    }
  }

  fun hideForCapture(onHidden: () -> Unit) {
    mainHandler.post {
      val view = overlayView
      if (view != null) {
        view.visibility = View.GONE
        // Short pause to guarantee the display subsystem redraws without the overlay
        mainHandler.postDelayed({
          onHidden()
        }, 120)
      } else {
        onHidden()
      }
    }
  }

  fun restoreAfterCapture() {
    mainHandler.post {
      overlayView?.visibility = View.VISIBLE
    }
  }

  fun destroy() {
    mainHandler.post {
      overlayView?.let { view ->
        try {
          windowManager.removeView(view)
          Log.d(TAG, "QuickCapture overlay removed")
        } catch (e: Exception) {
          Log.e(TAG, "Error removing overlay", e)
        }
      }
      overlayView = null
      layoutParams = null
    }
  }

  private class FloatingCaptureButtonView(context: Context) : View(context) {
    private val density = context.resources.displayMetrics.density
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#4338CA") // Deep SnapContact indigo
      style = Paint.Style.FILL
    }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#818CF8") // Accent ring
      style = Paint.Style.STROKE
      strokeWidth = 2f * density
    }
    private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      style = Paint.Style.STROKE
      strokeWidth = 2.4f * density
      strokeCap = Paint.Cap.ROUND
      strokeJoin = Paint.Join.ROUND
    }
    private val iconFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      style = Paint.Style.FILL
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val cx = width / 2f
      val cy = height / 2f
      val radius = (min(width, height) / 2f) - (2f * density)

      // Circular button background
      canvas.drawCircle(cx, cy, radius, backgroundPaint)
      canvas.drawCircle(cx, cy, radius, ringPaint)

      // Draw camera/scanner glyph inside the circle
      val cameraWidth = 22f * density
      val cameraHeight = 16f * density
      val left = cx - cameraWidth / 2f
      val top = cy - cameraHeight / 2f + (1f * density)
      val right = left + cameraWidth
      val bottom = top + cameraHeight

      // Camera body
      val bodyRect = RectF(left, top, right, bottom)
      canvas.drawRoundRect(bodyRect, 3f * density, 3f * density, iconPaint)

      // Camera lens
      canvas.drawCircle(cx, top + cameraHeight / 2f, 4f * density, iconPaint)

      // Lens center dot
      canvas.drawCircle(cx, top + cameraHeight / 2f, 1.2f * density, iconFillPaint)

      // Top notch
      val notchWidth = 6f * density
      val notchHeight = 2.5f * density
      val notchLeft = cx - notchWidth / 2f
      val notchTop = top - notchHeight
      canvas.drawRect(notchLeft, notchTop, notchLeft + notchWidth, top, iconFillPaint)
    }
  }
}
