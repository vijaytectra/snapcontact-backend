package com.snapcontact.capture

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object OcrProcessor {
  private const val TAG = "SnapContact_OCR"
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  suspend fun processBitmap(bitmap: Bitmap, rotationDegrees: Int = 0): String =
    processImage(InputImage.fromBitmap(bitmap, rotationDegrees))

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
