# Chair Mask Refinement Pipeline - Complete Documentation

## Overview

The **Chair Mask Refinement Pipeline** is a professional-grade image processing system that takes rough YOLOv8 segmentation masks and produces clean, smooth, high-quality masks for realistic texture application on chair designs.

### Key Features

- ✅ **Multi-stage refinement pipeline** - 7-step process for maximum quality
- ✅ **Morphological operations** - Remove noise and fill holes
- ✅ **Smart contour smoothing** - Reduce jagged edges while preserving shape
- ✅ **Edge alignment** - Snap boundaries to actual image features
- ✅ **Adaptive parameter tuning** - Automatic optimization based on image analysis
- ✅ **Batch processing** - Process multiple images and chair parts efficiently
- ✅ **Quality metrics** - Measure and compare refinement effectiveness
- ✅ **Comprehensive visualization** - Before/after comparisons and overlays
- ✅ **Well-documented** - Modular, extensively commented code

---

## Pipeline Architecture

### Processing Pipeline (7 Steps)

```
[Rough Mask]
    ↓
1. Preprocess (Binary conversion, Resizing)
    ↓
2. Noise Removal (Morphological Opening)
    ↓
3. Hole Filling (Morphological Closing)
    ↓
4. Edge Smoothing (Gaussian Blur)
    ↓
5. Contour Smoothing (Polygon Approximation)
    ↓
6. Edge Alignment (Snap to image edges)
    ↓
7. Postprocessing (Final cleaning)
    ↓
[Clean Professional Mask]
```

### Step Details

#### 1. **Preprocess**
- Ensures mask is binary (0/1 values only)
- Resizes mask to match original image if needed
- Handles various input formats (0-255 grayscale, float, etc.)

#### 2. **Noise Removal**
- Uses morphological **opening** (erosion → dilation)
- Removes small white noise artifacts from YOLOv8 output
- Configurable kernel size: `morph_kernel_size` (default: 5)
- Iterations: `morph_iterations` (default: 2)

#### 3. **Hole Filling**
- Uses morphological **closing** (dilation → erosion)
- Fills small black holes inside regions
- Includes flood-fill for complete region filling
- Preserves main shape while cleaning interior

#### 4. **Edge Smoothing**
- Applies Gaussian blur to soften jagged boundaries
- Blur radius: `blur_radius` (default: 5)
- Thresholded back to binary for clean edges

#### 5. **Contour Smoothing**
- Extracts contours using `cv2.findContours()`
- Approximates with **Douglas-Peucker algorithm** (`cv2.approxPolyDP()`)
- Parameter: `contour_epsilon_factor` (default: 0.01)
  - Lower values = more detail preserved
  - Higher values = more aggressive smoothing
- Redraws smoothed contours back to mask

#### 6. **Edge Alignment**
- Detects edges in original image using **Canny edge detector**
- Parameters: `canny_low_threshold` (50), `canny_high_threshold` (150)
- Dilates edges for easier alignment: `edge_dilation_kernel` (3)
- Refines mask by snapping boundaries to detected edges
- Improves realism by aligning to actual image features

#### 7. **Postprocessing**
- Final binary enforcement (0 and 1 only)
- Cleanup morphological closing
- Quality verification and logging

---

## Installation & Setup

### Requirements

```bash
pip install opencv-python numpy matplotlib pillow
```

### Optional (for YOLOv8 integration)

```bash
pip install ultralytics
```

### File Structure

```
backend/
├── mask_refinement_pipeline.py      # Main pipeline
├── yolov8_mask_integration.py       # YOLOv8 integration layer
├── mask_refinement_demo.py          # Demo and testing
└── mask_refinement_docs.md          # This file
```

---

## Quick Start

### Basic Usage

```python
from mask_refinement_pipeline import MaskRefinementPipeline
import cv2

# Initialize pipeline
pipeline = MaskRefinementPipeline()

# Load image and mask
image = cv2.imread('chair.jpg')
rough_mask = cv2.imread('rough_mask.png', cv2.IMREAD_GRAYSCALE)

# Refine the mask
refined_mask = pipeline.refine_mask(
    rough_mask,
    original_image=image,
    target_shape=(512, 512),  # Optional: resize to specific size
    align_with_edges=True      # Use image edges to refine
)

# Save result
cv2.imwrite('refined_mask.png', refined_mask * 255)
```

### Batch Processing

```python
# Process multiple masks (e.g., seat, backrest, arms, base)
masks_dict = {
    'seat': seat_mask,
    'backrest': backrest_mask,
    'arms': arms_mask,
    'base': base_mask
}

refined_masks = pipeline.refine_masks_batch(
    masks_dict,
    original_image=image,
    target_shape=(512, 512),
    align_with_edges=True
)

# Visualize results
pipeline.visualize_masks(image, refined_masks)

# Save all refined masks
saved_paths = pipeline.save_masks(refined_masks, prefix='refined')
```

---

## YOLOv8 Integration

### Direct Integration with YOLOv8 Segmentation

```python
from ultralytics import YOLO
from yolov8_mask_integration import YOLOv8MaskIntegration
import cv2

# Load YOLOv8 model
model = YOLO('yolov8-seg.pt')

# Run inference
image_path = 'chair.jpg'
results = model.predict(image_path)

# Initialize integration
integration = YOLOv8MaskIntegration()

# Load original image
image = cv2.imread(image_path)

# Extract and refine YOLOv8 masks
refined_masks = integration.refine_yolo_masks(
    results[0],
    original_image=image,
    image_shape=image.shape[:2],
    align_with_edges=True
)

# Visualize and save
integration.pipeline.visualize_masks(image, refined_masks)
integration.pipeline.save_masks(refined_masks, prefix='refined')
```

---

## Configuration & Parameter Tuning

### RefinementConfig Parameters

```python
from mask_refinement_pipeline import RefinementConfig, MaskRefinementPipeline

config = RefinementConfig(
    # Morphological operations
    morph_kernel_size=5,        # Kernel size (odd number, 3-11 typical)
    morph_iterations=2,         # Number of open/close iterations
    
    # Gaussian blur for smoothing
    blur_radius=5,              # Blur kernel size (odd number, 3-11 typical)
    
    # Contour approximation
    contour_epsilon_factor=0.01,  # 0.005=fine detail, 0.01=moderate, 0.02=heavy
    
    # Canny edge detection
    canny_low_threshold=50,
    canny_high_threshold=150,
    edge_dilation_kernel=3,
    
    # Visualization
    visualize=True,
    output_dir=Path('./mask_outputs')
)

pipeline = MaskRefinementPipeline(config)
```

### Preset Configurations

#### **Preserve Detail** (Photographs with fine features)
```python
config = RefinementConfig(
    morph_kernel_size=3,
    morph_iterations=1,
    blur_radius=3,
    contour_epsilon_factor=0.005,  # Preserve fine details
)
```

#### **Balanced** (Normal use case)
```python
config = RefinementConfig(
    morph_kernel_size=5,
    morph_iterations=2,
    blur_radius=5,
    contour_epsilon_factor=0.01,   # Moderate smoothing
)
```

#### **Heavy Smoothing** (Noisy YOLOv8 masks)
```python
config = RefinementConfig(
    morph_kernel_size=7,
    morph_iterations=3,
    blur_radius=7,
    contour_epsilon_factor=0.02,   # Aggressive smoothing
)
```

### Adaptive Parameter Tuning

Automatically determine best parameters for an image:

```python
from yolov8_mask_integration import YOLOv8MaskIntegration

integration = YOLOv8MaskIntegration()

# Analyze image
metrics = integration.analyze_image_characteristics(image)
print(metrics)
# Output: {
#    'contrast': 45.2,
#    'edge_density': 0.12,
#    'blur_level': 234.5,
#    'noise_level': 18.3
# }

# Get suggested parameters
config = integration.suggest_parameters(image)

# Use suggested config
pipeline = MaskRefinementPipeline(config)
refined_mask = pipeline.refine_mask(mask, image)
```

---

## Batch Processing

### Single Image, Multiple Parts

```python
masks = {
    'seat': seat_mask,
    'backrest': backrest_mask,
    'arms': arms_mask,
    'base': base_mask
}

refined = pipeline.refine_masks_batch(masks, image)
```

### Multiple Images

```python
from pathlib import Path

image_folder = Path('chair_images/')
output_folder = Path('refined_masks/')

results = integration.process_image_folder(
    image_folder,
    output_folder=output_folder,
    adaptive_tuning=True  # Use adaptive parameters per image
)

for image_name, result_info in results.items():
    print(f"Processed: {image_name}")
```

---

## Quality Assessment

### Measure Refinement Effectiveness

```python
metrics = integration.calculate_mask_quality_score(
    original_mask,
    refined_mask
)

print(f"Smoothness improvement: {metrics['smoothness_improvement']:.3f}")
print(f"Area preservation: {metrics['area_preservation']:.3f}")
print(f"Simplification ratio: {metrics['simplification_ratio']:.3f}")
```

### Metrics Explained

| Metric | Range | Interpretation |
|--------|-------|-----------------|
| `smoothness_improvement` | 0 - ∞ | Higher = smoother edges (positive number) |
| `area_preservation` | 0.8 - 1.2 | Closer to 1.0 = better preservation |
| `simplification_ratio` | 0 - 1 | Lower = more point reduction (more aggressive smoothing) |

---

## Visualization

### Before/After Comparison

```python
integration.compare_masks_visualize(
    original_image=image,
    original_masks=rough_masks,
    refined_masks=refined_masks,
    output_path=Path('comparison.png')
)
```

### Mask Overlay on Image

```python
pipeline.visualize_masks(
    image,
    refined_masks,
    title="Refined Chair Segmentation"
)
```

### Custom Visualization

```python
import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 2)

axes[0].imshow(original_mask, cmap='gray')
axes[0].set_title('Original Mask')

axes[1].imshow(refined_mask, cmap='gray')
axes[1].set_title('Refined Mask')

plt.show()
```

---

## Integration with Texture Application

### Complete Workflow

```python
from ultralytics import YOLO
from yolov8_mask_integration import YOLOv8MaskIntegration
import cv2

# Step 1: Run YOLOv8 segmentation
model = YOLO('yolov8-seg.pt')
results = model.predict('chair.jpg')

# Step 2: Refine masks
integration = YOLOv8MaskIntegration()
image = cv2.imread('chair.jpg')
refined_masks = integration.refine_yolo_masks(results[0], image, image.shape[:2])

# Step 3: Apply textures to refined masks
# (Use these masks in your texture application pipeline)
for part_name, mask in refined_masks.items():
    # Apply texture using mask
    textured_region = apply_texture(image, mask, texture_image)
```

---

## Performance & Optimization

### Processing Time

Typical performance on a 512x512 image:
- Single mask: ~100-200ms
- 4 masks (complete chair): ~400-800ms
- Batch (10 images): ~4-8 seconds

### Memory Usage

- Memory footprint: ~100MB for 512x512 image
- Scales linearly with image size

### Optimization Tips

1. **Reduce image size** if processing large images (>1024x1024)
2. **Skip edge alignment** for faster processing (remove `align_with_edges`)
3. **Smaller kernel sizes** for faster morphological operations
4. **Process in batches** to reuse memory

---

## Troubleshooting

### Issue: Masks too smooth (losing detail)

**Solution:**
```python
config.morph_kernel_size = 3
config.blur_radius = 3
config.contour_epsilon_factor = 0.005
```

### Issue: Masks still too jagged (not smooth enough)

**Solution:**
```python
config.morph_kernel_size = 7
config.blur_radius = 7
config.contour_epsilon_factor = 0.02
```

### Issue: Mask doesn't align to image boundaries

**Solution:**
```python
refined_mask = pipeline.refine_mask(
    mask,
    original_image=image,
    align_with_edges=True  # Enable edge alignment
)

# Lower Canny thresholds for weaker edges
config.canny_low_threshold = 30
config.canny_high_threshold = 100
```

### Issue: Holes not filled inside mask

**Solution:**
```python
config.morph_iterations = 3  # Increase iterations
# Or manually fill holes:
refined_mask = pipeline.fill_holes(mask)
```

---

## Testing & Demonstration

Run the comprehensive demo:

```bash
python mask_refinement_demo.py
```

This generates:
- `01_before_after_comparison.png` - Before/after for all parts
- `02_parameter_effects.png` - Different smoothing levels
- `03_edge_alignment.png` - Effect of edge alignment
- `04_adaptive_tuning.png` - Default vs adaptive parameters
- `05_quality_metrics.png` - Quality assessment charts

---

## Best Practices

### 1. **Start with Adaptive Tuning**
```python
config = integration.suggest_parameters(image)
```

### 2. **Always Use Edge Alignment**
Improves realism and accuracy. Requires `original_image` but worth it.

### 3. **Validate with Quality Metrics**
```python
metrics = integration.calculate_mask_quality_score(original, refined)
```

### 4. **Batch Process Similar Images**
Use same config for images with similar characteristics to save tuning time.

### 5. **Visualize During Development**
Always check `visualize_masks()` output before deploying.

### 6. **Keep Original Masks**
Store unrefined masks for comparison and debugging.

---

## Advanced Topics

### Custom Morphological Kernels

```python
import cv2

# Different kernel shapes
kernel_ellipse = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
kernel_rect = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
kernel_cross = cv2.getStructuringElement(cv2.MORPH_CROSS, (5, 5))

# Apply custom kernel
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_ellipse)
```

### Multi-Scale Processing

Process at multiple resolutions for better results:

```python
scales = [0.5, 1.0, 1.5]
refined_scales = []

for scale in scales:
    h, w = [int(image.shape[i] * scale) for i in [0, 1]]
    resized_mask = cv2.resize(mask, (w, h))
    refined = pipeline.refine_mask(resized_mask, cv2.resize(image, (w, h)))
    refined_scales.append(refined)

# Average results
final_mask = np.mean(refined_scales, axis=0)
final_mask = (final_mask > 0.5).astype(np.uint8)
```

### Custom Post-Processing

```python
def custom_postprocess(mask):
    # Apply additional constraints
    # E.g., ensure minimum region size
    
    contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        if cv2.contourArea(contour) < MIN_AREA:
            cv2.drawContours(mask, [contour], 0, 0, -1)  # Remove small regions
    
    return mask
```

---

## API Reference

### MaskRefinementPipeline

**Methods:**
- `refine_mask(mask, original_image, target_shape, align_with_edges)` - Refine single mask
- `refine_masks_batch(masks, original_image, target_shape, align_with_edges)` - Batch processing
- `preprocess_mask(mask, target_shape)` - Step 1
- `remove_noise(mask)` - Step 2
- `fill_holes(mask)` - Step 3
- `smooth_edges(mask)` - Step 4
- `smooth_contours(mask)` - Step 5
- `align_with_edges(mask, image)` - Step 6
- `postprocess_mask(mask)` - Step 7
- `visualize_masks(image, masks, title)` - Visualization
- `save_masks(masks, prefix)` - Save to disk
- `load_mask(filepath)` - Load from disk

### YOLOv8MaskIntegration

**Methods:**
- `extract_masks_from_yolo_results(yolo_results, image_shape, class_names)` - Extract YOLOv8 masks
- `refine_yolo_masks(yolo_results, image, image_shape, class_names, align_with_edges)` - End-to-end
- `analyze_image_characteristics(image)` - Image analysis
- `suggest_parameters(image)` - Auto-tune parameters
- `calculate_mask_quality_score(original, refined)` - Quality metrics
- `compare_masks_visualize(image, original_masks, refined_masks, output_path)` - Comparison
- `process_image_folder(image_folder, output_folder, image_extensions, adaptive_tuning)` - Batch

---

## Contributing & Customization

The code is modular and extensively documented. Easy to extend:

1. Add new morphological operations in `remove_noise()` or `fill_holes()`
2. Implement custom post-processing in `postprocess_mask()`
3. Extend visualization with `visualize_masks()`
4. Add new quality metrics in `calculate_mask_quality_score()`

---

## License

This pipeline is part of the DesignableAI project.

---

## Contact & Support

For issues, suggestions, or questions about the pipeline, contact the DesignableAI team.

---

**Last Updated:** February 2026
**Version:** 1.0.0
