package com.snapcontact.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import java.io.File
import java.io.InputStream

/**
 * Opens an image for OCR ourselves instead of ML Kit's InputImage.fromFilePath, which crashed
 * on some picker/camera URIs with "Attempt to invoke virtual method 'java.lang.Class
 * java.lang.Object.getClass()' on a null object reference".
 *
 * Returns the decoded bitmap plus its EXIF rotation, so camera photos are still read upright,
 * and downsamples very large photos so decoding cannot run out of memory.
 */
object ImageLoader {
  // ML Kit text recognition gains nothing above this; screenshots (~1080x2400) stay full size.
  private const val MAX_SIDE = 3000

  class LoadedImage(val bitmap: Bitmap, val rotationDegrees: Int)

  /** @throws IllegalArgumentException with a user-readable message when the image can't be opened. */
  fun load(context: Context, uri: Uri): LoadedImage {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(context, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw IllegalArgumentException("Could not open this image. Try a JPG or PNG screenshot.")
    }

    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_SIDE) sample *= 2

    val bitmap = open(context, uri).use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: throw IllegalArgumentException("Could not read this image. Try a JPG or PNG screenshot.")

    return LoadedImage(bitmap, rotationOf(context, uri))
  }

  private fun rotationOf(context: Context, uri: Uri): Int = try {
    open(context, uri).use { stream ->
      when (ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90, ExifInterface.ORIENTATION_TRANSPOSE -> 90
        ExifInterface.ORIENTATION_ROTATE_180, ExifInterface.ORIENTATION_FLIP_VERTICAL -> 180
        ExifInterface.ORIENTATION_ROTATE_270, ExifInterface.ORIENTATION_TRANSVERSE -> 270
        else -> 0
      }
    }
  } catch (e: Exception) {
    0 // No or unreadable EXIF (PNG screenshots): already upright.
  }

  private fun open(context: Context, uri: Uri): InputStream {
    val stream = when (uri.scheme) {
      null, "file" -> File(uri.path ?: throw IllegalArgumentException("Image path is missing.")).inputStream()
      else -> context.contentResolver.openInputStream(uri)
    }
    return stream ?: throw IllegalArgumentException("Could not open this image. Please pick it again.")
  }
}
