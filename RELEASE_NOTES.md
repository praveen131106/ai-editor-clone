# Release Notes - NovaGlow AI (v1.0.0-MVP)

This release marks the final submission-ready state of the NovaGlow AI mobile creative studio. The application has been audited, stabilized, and documented for public publication.

## 🚀 Features Delivered

### 1. Beauty Studio (Retouch Tool)
* Smooth skin sliding control backed by bilateral blur overlays.
* Glow effect sliding control.
* Face-slimming scale adjustment slider.
* Eye-widening transform control.
* Multi-preset filter curves (Golden Hour, Soft Glam, signature NovaGlow, etc.).

### 2. Background Swap (Backdrop Tool)
* High-definition local scene replacements (Beach, Office, Studio, Sunset, Luxury Room).
* Subject rendering in a centered, framed layout over the selected backdrop.
* Edge gradient integration to blend the subject layer into the environment.

### 3. Object Eraser (Smart Healing Tool)
* Touch-gesture paint brush tracking mask input.
* Scalable blur radius adjusted automatically to match brush size.
* Translucent visual overlay showing painted masks before applying.

### 4. AI Avatar Studio
* Offline image transformations matching selected styles (Professional, Anime, Cyberpunk, Fashion, Influencer).
* Image processing leveraging `expo-image-manipulator` to generate output URIs.

### 5. AI Story Studio
* Dynamic text overlays with customized labels, text sizes, and colors.
* Creative theme layout templates (Magazine, Retro, Neon, Influencer).

### 6. Viewport Integration
* Real-time before/after comparison toggle.
* Viewport capturing (`react-native-view-shot`) to bake all visual adjustments, texts, and layers into a final downloadable JPEG.

---

## 🛠️ Technical Challenges & Solutions

### 1. Preventing "Cannot read property 'base64' of undefined" Crashes
* **Problem**: The app suffered runtime failures when accessing raw base64 data from `ImagePicker` results, which returned incomplete asset payloads or failed to load files.
* **Solution**: 
  - Implemented `safeGetBase64(uri)` inside `lib/imageProcessing.ts` to perform detailed file checks, fetch remote assets safely, and validate final encodings.
  - Added optional chaining (`?.`) safeguards across all base64 reference paths.
  - Established a strict offline simulator fallback path that continues editing even if the remote AI API is unreachable.

### 2. Export Quality Stabilization
* **Problem**: Downloader outputs were mismatched compared to the active editor viewport, saving original unedited resources instead of the user's modifications.
* **Solution**: Developed a unified viewport baking workflow. When saving, the app captures the composite viewport node directly via `react-native-view-shot`, producing a single baked asset preserving filters, text, masks, and layers.

### 3. Clean Interface Maintenance
* **Problem**: AI Video and unfinished features cluttered the landing views and caused confusion.
* **Solution**: Hidden non-functional modules like the video timeline from the primary user dashboard, maintaining code references for future upgrades while showing only fully validated, working components in production.

---

## ⚠️ Limitations & Integration Options

* **Supabase Offline Fallback**: Real background segmentation and image inpainting require an active backend. When these keys are absent, the application triggers offline simulators that composite layers visually so the user can still test and export results.
* **Local Processing Constraints**: Complex image processing is simulated client-side to respect standard Expo environment constraints and avoid heavy native binary requirements.

---

## 🔮 Future Roadmap

1. **Active Segmentation**: Hook up the Supabase Edge Functions with a hosted segmentation model (e.g. RMBG-1.4 or Segment Anything) for automatic subject outlines.
2. **Generative Fill**: Integrate Stable Diffusion Inpainting to replace the client-side blur eraser with generative fill capabilities.
3. **Multi-Track Video Trimming**: Restore the Video Studio with local web assembly FFmpeg bindings to allow genuine mobile video trimming.
