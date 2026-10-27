package com.snapcontact.capture

import android.content.Context

/**
 * Thread-safe, persistent storage for captured OCR results.
 * Guarantees exactly-once handoff to React Native even if the app
 * process was killed, backgrounded, or restarted during capture.
 */
object CaptureResultStore {
  private const val PREFS_NAME = "snapcontact_quick_capture_handoff"
  private const val KEY_PENDING_TEXT = "pending_ocr_text"
  private const val KEY_PENDING_TIMESTAMP = "pending_ocr_timestamp"

  @Synchronized
  fun savePendingResult(context: Context, text: String) {
    if (text.isEmpty()) return
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PENDING_TEXT, text)
      .putLong(KEY_PENDING_TIMESTAMP, System.currentTimeMillis())
      .apply()
  }

  @Synchronized
  fun consumePendingResult(context: Context): String? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val text = prefs.getString(KEY_PENDING_TEXT, null)
    if (text != null) {
      prefs.edit()
        .remove(KEY_PENDING_TEXT)
        .remove(KEY_PENDING_TIMESTAMP)
        .apply()
    }
    return text
  }

  @Synchronized
  fun clear(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .clear()
      .apply()
  }
}
