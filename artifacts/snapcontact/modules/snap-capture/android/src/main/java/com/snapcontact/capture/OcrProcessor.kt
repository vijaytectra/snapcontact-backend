package com.snapcontact.capture

import android.graphics.Bitmap
import android.graphics.Matrix
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.abs

object OcrProcessor {
  private const val TAG = "SnapContact_OCR"
  // Fewer digits than this in the first reading means the photo is probably sideways, tilted or blurry.
  private const val ENOUGH_DIGITS = 7
  // Enlarging a blurry photo only when it is not already huge keeps memory use within reach.
  private const val MAX_WIDTH_TO_ENLARGE = 1500

  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  /**
   * Reads a photo whatever its orientation. The first reading is used when it finds enough digits.
   * Otherwise the photo is straightened by the tilt of its text lines and read again, then turned
   * to 90, 180 and 270 degrees, and finally enlarged, keeping the reading with the most digits.
   */
  suspend fun processBitmap(bitmap: Bitmap, rotationDegrees: Int = 0): String {
    val upright = rotate(bitmap, rotationDegrees.toFloat())
    var best = readBitmap(upright)

    val skew = dominantSkew(best.second)
    if (abs(skew) >= 2f) {
      val straight = readBitmap(rotate(upright, -skew))
      if (digitCount(straight.first) > digitCount(best.first)) best = straight
    }

    if (digitCount(best.first) < ENOUGH_DIGITS) {
      for (turn in listOf(90f, 270f, 180f)) {
        val candidate = readBitmap(rotate(upright, turn))
        if (digitCount(candidate.first) > digitCount(best.first)) best = candidate
      }
    }

    // Blurred photos often read as partial numbers ("+1 202-55") that still pass the digit check,
    // so the enlarged copy is always read too, and the reading with the most digits is kept.
    if (upright.width <= MAX_WIDTH_TO_ENLARGE) {
      val enlarged = readBitmap(scale(upright, 2f))
      if (digitCount(enlarged.first) > digitCount(best.first)) best = enlarged
    }

    Log.d(TAG, "OCR best reading has ${digitCount(best.first)} digits, skew ${"%.1f".format(skew)}")
    return best.first
  }

  // Failures are thrown, not turned into empty text, so callers can show the real reason
  // instead of "No readable text found".
  suspend fun processImage(image: InputImage): String = formatText(recognize(image))

  private suspend fun readBitmap(bitmap: Bitmap): Pair<String, Text> {
    val visionText = recognize(InputImage.fromBitmap(bitmap, 0))
    return formatText(visionText) to visionText
  }

  private suspend fun recognize(image: InputImage): Text = suspendCancellableCoroutine { continuation ->
    Log.d(TAG, "OCR started on ${image.width}x${image.height} image, rotation ${image.rotationDegrees}")
    recognizer.process(image)
      .addOnSuccessListener { visionText ->
        if (continuation.isActive) continuation.resume(visionText)
      }
      .addOnFailureListener { error ->
        Log.e(TAG, "OCR recognition failed", error)
        if (continuation.isActive) {
          continuation.resumeWithException(IllegalStateException("Text recognition failed: ${error.message ?: error.javaClass.simpleName}", error))
        }
      }
  }

  /** Median tilt, in degrees, of the text lines. Positive means the text runs clockwise. */
  private fun dominantSkew(text: Text): Float {
    val angles = text.textBlocks.flatMap { it.lines }.mapNotNull { line ->
      val points = line.cornerPoints ?: return@mapNotNull null
      if (points.size < 2 || line.text.length < 6) return@mapNotNull null
      val dx = (points[1].x - points[0].x).toDouble()
      val dy = (points[1].y - points[0].y).toDouble()
      val angle = Math.toDegrees(Math.atan2(dy, dx))
      if (abs(angle) <= 30.0) angle.toFloat() else null
    }.sorted()
    return if (angles.isEmpty()) 0f else angles[angles.size / 2]
  }

  private fun rotate(bitmap: Bitmap, degrees: Float): Bitmap {
    if (degrees % 360f == 0f) return bitmap
    val matrix = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  private fun scale(bitmap: Bitmap, factor: Float): Bitmap =
    Bitmap.createScaledBitmap(bitmap, (bitmap.width * factor).toInt(), (bitmap.height * factor).toInt(), true)

  private fun digitCount(text: String): Int = text.count { it.isDigit() }

  private fun formatText(visionText: Text): String {
    return try {
      val sortedBlocks = visionText.textBlocks.sortedBy { it.boundingBox?.top ?: 0 }
      val builder = StringBuilder()
      // A blank line marks the end of a card. ML Kit splits one card into several blocks (a name
      // and its number often land in different blocks), so blocks alone do not mark a card: only a
      // clear vertical gap, well over one line's height, does.
      var previousBottom: Int? = null
      var previousHeight = 0
      for (block in sortedBlocks) {
        val sortedLines = block.lines.sortedBy { it.boundingBox?.top ?: 0 }
        for (line in sortedLines) {
          val cleanLine = line.text.trim()
          if (cleanLine.isEmpty()) continue
          val box = line.boundingBox
          val bottom = previousBottom
          if (box != null && bottom != null && previousHeight > 0 &&
              box.top - bottom > previousHeight * 1.5f) {
            builder.append("\n")
          }
          builder.append(cleanLine).append("\n")
          if (box != null) {
            previousBottom = box.bottom
            previousHeight = box.height()
          }
        }
      }
      val result = builder.toString().trim()
      if (result.isNotEmpty()) result else visionText.text
    } catch (e: Exception) {
      Log.e(TAG, "Error formatting OCR blocks", e)
      visionText.text
    }
  }
}
