# Release builds are shrunk and renamed by R8. ML Kit's bundled OCR finds its Java classes by
# name from native code (JNI) and via component registrars, so renamed or removed classes
# make it fail with "Attempt to invoke virtual method 'java.lang.Class
# java.lang.Object.getClass()' on a null object reference". Keep ML Kit untouched.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class com.google.android.libraries.vision.** { *; }
-keep class com.google.android.odml.** { *; }
-keep class com.google.firebase.components.** { *; }
-keep class * implements com.google.firebase.components.ComponentRegistrar { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.internal.mlkit_**
