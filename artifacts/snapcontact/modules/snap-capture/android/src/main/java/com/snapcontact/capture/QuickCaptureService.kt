package com.snapcontact.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class QuickCaptureService : Service() {
  companion object {
    private const val TAG = "QuickCaptureService"
    private const val NOTIFICATION_ID = 2001
    private const val CHANNEL_ID = "snapcontact_quick_capture"
    const val ACTION_START = "com.snapcontact.capture.ACTION_START"
    const val ACTION_STOP = "com.snapcontact.capture.ACTION_STOP"
    const val ACTION_CAPTURE = "com.snapcontact.capture.ACTION_CAPTURE"

    @Volatile
    var isRunning = false
      private set

    private var activeInstance: QuickCaptureService? = null

    fun onConsentGranted(resultCode: Int, data: Intent) {
      activeInstance?.handleConsentGranted(resultCode, data)
    }

    fun onConsentDenied() {
      activeInstance?.handleConsentDenied()
    }
  }

  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
  private lateinit var overlay: QuickCaptureOverlay
  private lateinit var screenCaptureManager: ScreenCaptureManager
  private lateinit var mediaProjectionManager: MediaProjectionManager

  private var pendingConsentResultCode: Int? = null
  private var pendingConsentData: Intent? = null
  private val isCapturing = java.util.concurrent.atomic.AtomicBoolean(false)

  override fun onCreate() {
    super.onCreate()
    activeInstance = this
    isRunning = true
    mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    screenCaptureManager = ScreenCaptureManager(this)

    createNotificationChannel()
    startForegroundAsSpecialUse()

    overlay = QuickCaptureOverlay(this) {
      handleCaptureRequested()
    }
    overlay.show()
    SnapCaptureModule.notifyStarted()
    Log.d(TAG, "QuickCaptureService created and overlay displayed")
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        Log.d(TAG, "Stop action received in QuickCaptureService")
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_CAPTURE -> {
        handleCaptureRequested()
      }
    }
    return START_STICKY
  }

  private fun handleCaptureRequested() {
    if (!isCapturing.compareAndSet(false, true)) {
      Log.d(TAG, "Capture already in progress, ignoring tap")
      return
    }

    overlay.hideForCapture {
      val resultCode = pendingConsentResultCode
      val data = pendingConsentData

      if (resultCode != null && data != null && Build.VERSION.SDK_INT < 34) {
        // On Android 13 and below, reused consent token can work
        performCapture(resultCode, data)
      } else {
        // On Android 14+ (or first capture), MediaProjection tokens are single-use
        Log.d(TAG, "Requesting MediaProjection consent for capture")
        MediaProjectionConsentActivity.launch(this)
      }
    }
  }

  private fun handleConsentGranted(resultCode: Int, data: Intent) {
    pendingConsentResultCode = resultCode
    pendingConsentData = data
    performCapture(resultCode, data)
  }

  private fun handleConsentDenied() {
    Log.w(TAG, "MediaProjection consent was denied")
    isCapturing.set(false)
    overlay.restoreAfterCapture()
    SnapCaptureModule.notifyError("Screen capture permission was declined.")
  }

  private fun performCapture(resultCode: Int, data: Intent) {
    serviceScope.launch(Dispatchers.Default) {
      var mediaProjection: MediaProjection? = null
      try {
        // Upgrade foreground service to mediaProjection NOW that user consent has been granted
        withContext(Dispatchers.Main) {
          upgradeForegroundToMediaProjection()
        }

        // Wait 350ms so system consent dialog and translucent activity dismiss completely,
        // ensuring Instagram / active app is fully drawn on screen before capture.
        delay(350)

        mediaProjection = mediaProjectionManager.getMediaProjection(resultCode, data.clone() as Intent)
        if (mediaProjection == null) {
          throw IllegalStateException("Failed to acquire MediaProjection instance")
        }

        val bitmap = screenCaptureManager.captureFrame(mediaProjection)
        if (bitmap == null) {
          throw IllegalStateException("Failed capturing screen frame")
        }

        // Run OCR on captured bitmap
        val recognizedText = OcrProcessor.processBitmap(bitmap)
        bitmap.recycle()

        // Persist recognized text for reliable handoff even if app was backgrounded
        CaptureResultStore.savePendingResult(this@QuickCaptureService, recognizedText)

        // Notify Expo TypeScript module via event if app is already active
        SnapCaptureModule.notifyScreenCaptured(recognizedText)

        // Bring SnapContact to front to review detected contacts
        bringAppToFront()
      } catch (e: Exception) {
        Log.e(TAG, "Screen capture or OCR failed", e)
        SnapCaptureModule.notifyError(e.message ?: "Screen capture failed")
      } finally {
        try {
          mediaProjection?.stop()
        } catch (e: Exception) {
          Log.e(TAG, "Error stopping MediaProjection", e)
        }
        // Demote foreground service back to specialUse safely
        withContext(Dispatchers.Main) {
          startForegroundAsSpecialUse()
        }
        isCapturing.set(false)
        // Restore overlay for future captures
        overlay.restoreAfterCapture()
      }
    }
  }

  private fun bringAppToFront() {
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
      }
      if (launchIntent != null) {
        startActivity(launchIntent)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error bringing SnapContact to front", e)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "SnapContact Quick Capture",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Provides one-tap screen capture overlay for extracting contacts from any app"
        setShowBadge(false)
      }
      val notificationManager = getSystemService(NotificationManager::class.java)
      notificationManager?.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val stopIntent = Intent(this, QuickCaptureService::class.java).apply {
      action = ACTION_STOP
    }
    val stopPendingIntent = PendingIntent.getService(
      this, 0, stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    }
    val openAppPendingIntent = PendingIntent.getActivity(
      this, 0, openAppIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("SnapContact Quick Capture Active")
      .setContentText("Tap the floating icon over Instagram, LinkedIn, or WhatsApp to capture contacts")
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentIntent(openAppPendingIntent)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun startForegroundAsSpecialUse() {
    val notification = buildNotification()
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error starting foreground as specialUse, fallback to standard", e)
      try {
        startForeground(NOTIFICATION_ID, notification)
      } catch (inner: Exception) {
        Log.e(TAG, "Fatal fallback startForeground failure", inner)
      }
    }
  }

  private fun upgradeForegroundToMediaProjection() {
    val notification = buildNotification()
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        )
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error promoting foreground service to mediaProjection", e)
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    Log.d(TAG, "QuickCaptureService onDestroy")
    isRunning = false
    activeInstance = null
    overlay.destroy()
    serviceScope.cancel()
    SnapCaptureModule.notifyStopped()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
