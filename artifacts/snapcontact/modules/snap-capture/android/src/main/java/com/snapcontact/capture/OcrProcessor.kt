package com.snapcontact.capture

import android.graphics.Bitmap
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

object OcrProcessor {
  private const val TAG = "SnapContact_OCR"
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  suspend fun processBitmap(bitmap: Bitmap): String = suspendCancellableCoroutine { continuation ->
    try {
      val image = InputImage.fromBitmap(bitmap, 0)
      recognizer.process(image)
        .addOnSuccessListener { visionText ->
          try {
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
            val text = if (result.isNotEmpty()) result else visionText.text
            Log.d(TAG, "OCR succeeded, recognized ${text.length} characters")
            if (continuation.isActive) continuation.resume(text)
          } catch (e: Exception) {
            Log.e(TAG, "Error formatting OCR blocks", e)
            if (continuation.isActive) continuation.resume(visionText.text)
          }
        }
        .addOnFailureListener { error ->
          Log.e(TAG, "OCR recognition failed", error)
          if (continuation.isActive) continuation.resume("")
        }
    } catch (e: Exception) {
      Log.e(TAG, "Exception during ML Kit recognition", e)
      if (continuation.isActive) continuation.resume("")
    }
  }
}
