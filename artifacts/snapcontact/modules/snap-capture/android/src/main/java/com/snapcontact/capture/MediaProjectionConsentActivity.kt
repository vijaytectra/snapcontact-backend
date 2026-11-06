package com.snapcontact.capture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Log

class MediaProjectionConsentActivity : Activity() {
  companion object {
    private const val TAG = "MediaProjectionConsent"
    private const val REQUEST_MEDIA_PROJECTION = 1001

    fun launch(context: Context) {
      val intent = Intent(context, MediaProjectionConsentActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
      }
      context.startActivity(intent)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
    val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
    if (projectionManager == null) {
      Log.e(TAG, "MediaProjectionManager not available")
      handled = true // onDestroy must not report the same denial a second time
      QuickCaptureService.onConsentDenied()
      finish()
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
      return
    }

    try {
      Log.d(TAG, "Requesting MediaProjection user consent")
      // Android 14+: capture the whole screen by default, so the "choose an app" picker is skipped.
      // The system still asks the user to approve; the app cannot bypass that.
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        projectionManager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
      } else {
        projectionManager.createScreenCaptureIntent()
      }
      startActivityForResult(intent, REQUEST_MEDIA_PROJECTION)
    } catch (e: Exception) {
      Log.e(TAG, "Failed launching MediaProjection consent dialog", e)
      handled = true // onDestroy must not report the same denial a second time
      QuickCaptureService.onConsentDenied()
      finish()
      @Suppress("DEPRECATION")
      overridePendingTransition(0, 0)
    }
  }

  private var handled = false

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    handled = true
    if (requestCode == REQUEST_MEDIA_PROJECTION) {
      if (resultCode == RESULT_OK && data != null) {
        Log.d(TAG, "MediaProjection consent granted by user")
        QuickCaptureService.onConsentGranted(resultCode, data)
      } else {
        Log.w(TAG, "MediaProjection consent cancelled or denied by user")
        QuickCaptureService.onConsentDenied()
      }
    }
    finish()
    @Suppress("DEPRECATION")
    overridePendingTransition(0, 0)
  }

  override fun onDestroy() {
    super.onDestroy()
    if (!handled) {
      handled = true
      QuickCaptureService.onConsentDenied()
    }
  }
}
