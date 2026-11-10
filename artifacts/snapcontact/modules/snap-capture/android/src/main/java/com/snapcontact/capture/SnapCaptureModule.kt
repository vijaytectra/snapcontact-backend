package com.snapcontact.capture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.ContactsContract
import android.provider.Settings
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SnapCaptureModule : Module() {
  companion object {
    private const val TAG = "SnapCaptureModule"
    private var instance: SnapCaptureModule? = null

    fun notifyStarted() {
      instance?.sendEvent("onQuickCaptureStarted", emptyMap<String, Any>())
    }

    fun notifyScreenCaptured(text: String) {
      instance?.sendEvent("onScreenCaptured", mapOf("text" to text))
    }

    fun notifyError(error: String) {
      instance?.sendEvent("onQuickCaptureError", mapOf("error" to error))
    }

    fun notifyStopped() {
      instance?.sendEvent("onQuickCaptureStopped", emptyMap<String, Any>())
    }
  }

  private val moduleScope = CoroutineScope(Dispatchers.IO)
  // The promise of the contact editor that is open now (null when none is).
  private var pendingEditor: Promise? = null
  private val EDITOR_REQUEST_CODE = 4217
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React application context is null")

  override fun definition() = ModuleDefinition {
    Name("SnapCapture")

    Events(
      "onQuickCaptureStarted",
      "onScreenCaptured",
      "onQuickCaptureError",
      "onQuickCaptureStopped"
    )

    OnCreate {
      instance = this@SnapCaptureModule
    }

    OnDestroy {
      if (instance === this@SnapCaptureModule) {
        instance = null
      }
    }

    // ISO country of the SIM (or the network it is on). Phone numbers follow the SIM, not the
    // UI language: many phones in India run en-US, which would otherwise default to +1.
    Function("simCountry") {
      try {
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        listOf(tm?.simCountryIso, tm?.networkCountryIso)
          .firstOrNull { !it.isNullOrBlank() && it.length == 2 }
          ?.uppercase()
      } catch (e: Exception) {
        null
      }
    }

    // Quick Capture APIs
    Function("hasOverlayPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }

    AsyncFunction("requestOverlayPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (Settings.canDrawOverlays(context)) {
          promise.resolve(true)
          return@AsyncFunction
        }
        try {
          val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${context.packageName}")
          ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          promise.resolve(false)
        } catch (e: Exception) {
          Log.e(TAG, "Failed launching overlay permission settings", e)
          promise.reject("OVERLAY_PERMISSION_ERROR", e.message, e)
        }
      } else {
        promise.resolve(true)
      }
    }

    Function("isQuickCaptureRunning") {
      QuickCaptureService.isRunning
    }

    AsyncFunction("startQuickCapture") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
        promise.reject("PERMISSION_DENIED", "SYSTEM_ALERT_WINDOW permission is not granted", null)
        return@AsyncFunction
      }

      try {
        val serviceIntent = Intent(context, QuickCaptureService::class.java).apply {
          action = QuickCaptureService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ContextCompat.startForegroundService(context, serviceIntent)
        } else {
          context.startService(serviceIntent)
        }
        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to start QuickCaptureService", e)
        promise.reject("SERVICE_START_FAILED", e.message, e)
      }
    }

    Function("stopQuickCapture") {
      try {
        val serviceIntent = Intent(context, QuickCaptureService::class.java).apply {
          action = QuickCaptureService.ACTION_STOP
        }
        context.startService(serviceIntent)
        true
      } catch (e: Exception) {
        Log.e(TAG, "Failed to stop QuickCaptureService", e)
        false
      }
    }

    AsyncFunction("requestScreenCapture") { promise: Promise ->
      if (!QuickCaptureService.isRunning) {
        promise.reject("SERVICE_NOT_RUNNING", "Quick Capture service is not currently running", null)
        return@AsyncFunction
      }
      try {
        val serviceIntent = Intent(context, QuickCaptureService::class.java).apply {
          action = QuickCaptureService.ACTION_CAPTURE
        }
        context.startService(serviceIntent)
        promise.resolve("CAPTURE_TRIGGERED")
      } catch (e: Exception) {
        promise.reject("CAPTURE_FAILED", e.message, e)
      }
    }

    Function("getPendingCaptureResult") {
      CaptureResultStore.consumePendingResult(context)
    }

    Function("clearPendingCaptureResult") {
      CaptureResultStore.clear(context)
      true
    }

    // Existing core APIs for camera / file OCR and contact editor
    AsyncFunction("recognize") { uriString: String, promise: Promise ->
      moduleScope.launch {
        try {
          // We decode the image and read its EXIF rotation ourselves (see ImageLoader):
          // ML Kit's InputImage.fromFilePath crashed on some URIs with a null getClass() error.
          val loaded = ImageLoader.load(context, Uri.parse(uriString))
          try {
            promise.resolve(OcrProcessor.processBitmap(loaded.bitmap, loaded.rotationDegrees))
          } finally {
            loaded.bitmap.recycle()
          }
        } catch (e: IllegalArgumentException) {
          Log.e(TAG, "recognize could not open image", e)
          promise.reject("INVALID_IMAGE", e.message ?: "Could not open this image.", e)
        } catch (e: OutOfMemoryError) {
          Log.e(TAG, "recognize ran out of memory", e)
          promise.reject("IMAGE_TOO_LARGE", "This image is too large to read. Try a screenshot or a smaller photo.", null)
        } catch (e: Exception) {
          Log.e(TAG, "recognize failed", e)
          // Keep the underlying reason visible so a failure on a user's phone can be diagnosed.
          val reason = (e.cause ?: e).let { it.message ?: it.javaClass.simpleName }
          promise.reject("RECOGNIZE_ERROR", "Could not read text from this image ($reason). Please try again.", e)
        }
      }
    }

    AsyncFunction("pendingImage") { promise: Promise ->
      val currentActivity = appContext.currentActivity
      val intent = currentActivity?.intent
      if (intent != null && intent.action == Intent.ACTION_SEND && intent.type?.startsWith("image/") == true) {
        val imageUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        promise.resolve(imageUri?.toString())
      } else {
        promise.resolve(null)
      }
    }

    // The editor is opened for a result, and the promise settles only when it closes. The status
    // comes from the editor's result code, not from the moment it opened, so a dismissed editor is
    // never reported as saved and the next contact is not opened on top of it.
    AsyncFunction("createContact") { name: String, number: String, promise: Promise ->
      val currentActivity = appContext.currentActivity
      if (currentActivity == null) {
        promise.reject("NO_ACTIVITY", "Current activity is null", null)
        return@AsyncFunction
      }
      if (pendingEditor != null) {
        // One editor at a time: a second request while one is open is not saved.
        promise.resolve(mapOf("status" to "cancelled"))
        return@AsyncFunction
      }

      try {
        val intent = Intent(Intent.ACTION_INSERT).apply {
          type = ContactsContract.Contacts.CONTENT_TYPE
          putExtra(ContactsContract.Intents.Insert.NAME, name)
          putExtra(ContactsContract.Intents.Insert.PHONE, number)
        }
        pendingEditor = promise
        currentActivity.startActivityForResult(intent, EDITOR_REQUEST_CODE)
      } catch (e: Exception) {
        Log.e(TAG, "Failed launching contact editor", e)
        pendingEditor = null
        promise.resolve(mapOf("status" to "cancelled"))
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == EDITOR_REQUEST_CODE) {
        val waiting = pendingEditor
        pendingEditor = null
        val saved = payload.resultCode == Activity.RESULT_OK
        waiting?.resolve(mapOf("status" to if (saved) "saved" else "cancelled"))
      }
    }

    AsyncFunction("clearImages") { promise: Promise ->
      moduleScope.launch {
        try {
          val cacheDir = context.cacheDir
          cacheDir.listFiles()?.forEach { file ->
            if (file.name.startsWith("snap_") && (file.name.endsWith(".jpg") || file.name.endsWith(".png"))) {
              file.delete()
            }
          }
          promise.resolve(null)
        } catch (e: Exception) {
          promise.resolve(null)
        }
      }
    }
  }
}
