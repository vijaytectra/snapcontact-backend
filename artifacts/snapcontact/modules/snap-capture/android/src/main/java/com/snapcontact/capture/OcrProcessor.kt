package com.snapcontact.capture

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object OcrProcessor {
  private const val TAG = "SnapContact_OCR"
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  // Play Services downloads the text model on first use; until then process() fails with
  // UNAVAILABLE. Wait for it rather than failing the user's first scan.
  private const val MODEL_WAIT_STEP_MS = 2_000L
  private const val MODEL_WAIT_ATTEMPTS = 12

  suspend fun processBitmap(bitmap: Bitmap, rotationDegrees: Int = 0): String {
    val image = InputImage.fromBitmap(bitmap, rotationDegrees)
    var attempt = 0
    while (true) {
      try {
        return processImage(image)
      } catch (e: IllegalStateException) {
        val modelMissing = (e.cause as? MlKitException)?.errorCode == MlKitException.UNAVAILABLE
        if (!modelMissing) throw e
        if (++attempt >= MODEL_WAIT_ATTEMPTS) {
          throw ModelUnavailableException()
        }
        Log.d(TAG, "Text model not downloaded yet, waiting (attempt $attempt)")
        delay(MODEL_WAIT_STEP_MS)
      }
    }
  }

  class ModelUnavailableException : Exception(
    "The text reader is still downloading. Stay connected to the internet and try again in a minute."
  )

  // Failures are thrown, not turned into empty text, so callers can show the real reason
  // instead of "No readable text found".
  suspend fun processImage(image: InputImage): String = suspendCancellableCoroutine { continuation ->
    Log.d(TAG, "OCR started on ${image.width}x${image.height} image, rotation ${image.rotationDegrees}")
    recognizer.process(image)
      .addOnSuccessListener { visionText ->
        val text = formatText(visionText)
        Log.d(TAG, "OCR succeeded, recognized ${text.length} characters")
        if (continuation.isActive) continuation.resume(text)
      }
      .addOnFailureListener { error ->
        Log.e(TAG, "OCR recognition failed", error)
        if (continuation.isActive) {
          continuation.resumeWithException(IllegalStateException("Text recognition failed: ${error.message ?: error.javaClass.simpleName}", error))
        }
      }
  }

  private fun formatText(visionText: Text): String {
    return try {
      val sortedBlocks = visionText.textBlocks.sortedBy { it.boundingBox?.top ?: 0 }
      val builder = StringBuilder()
      for (block in sortedBlocks) {
        val sortedLines = block.lines.sortedBy { it.boundingBox?.top ?: 0 }
        for (line in sortedLines) {
          val cleanLine = line.text.trim()
          if (cleanLine.isNotEmpty()) {
            builder.append(cleanLine).append("\n")
          }
        }
        builder.append("\n")
      }
      val result = builder.toString().trim()
      if (result.isNotEmpty()) result else visionText.text
    } catch (e: Exception) {
      Log.e(TAG, "Error formatting OCR blocks", e)
      visionText.text
    }
  }
}
