# Mask Refinement Pipeline - Quick Reference

## Installation

```bash
pip install -r mask_refinement_requirements.txt
```

## Basic Usage Snippets

### 1. Simple Single Mask Refinement

```python
from mask_refinement_pipeline import MaskRefinementPipeline
import cv2

pipeline = MaskRefinementPipeline()
image = cv2.imread('chair.jpg')
mask = cv2.imread('mask.png', cv2.IMREAD_GRAYSCALE)

refined = pipeline.refine_mask(mask, image)
cv2.imwrite('refined.png', refined * 255)
```

### 2. Batch Processing Multiple Parts

```python
masks = {
    'seat': mask_seat,
    'backrest': mask_backrest,
    'arms': mask_arms,
    'base': mask_base
}

refined = pipeline.refine_masks_batch(masks, image)
pipeline.visualize_masks(image, refined)
pipeline.save_masks(refined, prefix='refined')
```

### 3. YOLOv8 Direct Integration

```python
from ultralytics import YOLO
from yolov8_mask_integration import YOLOv8MaskIntegration

model = YOLO('yolov8-seg.pt')
results = model.predict('chair.jpg')

integration = YOLOv8MaskIntegration()
image = cv2.imread('chair.jpg')

refined = integration.refine_yolo_masks(
    results[0], image, image.shape[:2], align_with_edges=True
)
```

### 4. Adaptive Parameter Tuning

```python
config = integration.suggest_parameters(image)
pipeline = MaskRefinementPipeline(config)
refined = pipeline.refine_mask(mask, image)
```

### 5. Custom Configuration

```python
from mask_refinement_pipeline import RefinementConfig

config = RefinementConfig(
    morph_kernel_size=7,          # Larger = more smoothing
    blur_radius=7,                 # Larger = more blur
    contour_epsilon_factor=0.02,   # Larger = more smoothing
    canny_low_threshold=30,        # Lower = find more edges
    canny_high_threshold=100
)

pipeline = MaskRefinementPipeline(config)
```

### 6. Quality Assessment

```python
metrics = integration.calculate_mask_quality_score(
    original_mask, refined_mask
)
print(f"Smoothness: {metrics['smoothness_improvement']:.3f}")
print(f"Area preserved: {metrics['area_preservation']:.3f}")
```

### 7. Before/After Comparison

```python
integration.compare_masks_visualize(
    image, rough_masks, refined_masks,
    output_path=Path('comparison.png')
)
```

### 8. Batch Process Folder

```python
results = integration.process_image_folder(
    Path('chair_images/'),
    adaptive_tuning=True
)
```

---

## Parameter Presets

### For Detail Preservation
```python
config = RefinementConfig(
    morph_kernel_size=3,
    blur_radius=3,
    contour_epsilon_factor=0.005
)
```

### For Balanced Quality
```python
config = RefinementConfig(
    morph_kernel_size=5,
    blur_radius=5,
    contour_epsilon_factor=0.01
)
```

### For Heavy Smoothing
```python
config = RefinementConfig(
    morph_kernel_size=7,
    blur_radius=7,
    contour_epsilon_factor=0.02
)
```

---

## Image Metrics Available

```python
metrics = integration.analyze_image_characteristics(image)
# {
#   'contrast': float,          # Brightness variation
#   'edge_density': float,      # Density of edges (0-1)
#   'blur_level': float,        # High = sharp, Low = blurry
#   'noise_level': float        # Estimated noise amount
# }
```

---

## Quality Metrics

```python
quality = integration.calculate_mask_quality_score(orig, refined)
# {
#   'smoothness_improvement': float,    # Higher = better
#   'area_preservation': float,         # Closer to 1.0 = better
#   'simplification_ratio': float       # Lower = more reduction
# }
```

---

## File I/O

```python
# Save masks
saved = pipeline.save_masks(masks_dict, prefix='refined')

# Load mask
mask = pipeline.load_mask('refined_mask.png')

# Load image
image = pipeline.load_image('chair.jpg')
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Too smooth (lost detail) | Reduce `morph_kernel_size`, `blur_radius`, `contour_epsilon_factor` |
| Still too jagged | Increase `morph_kernel_size`, `blur_radius`, `contour_epsilon_factor` |
| Doesn't align to edges | Use `align_with_edges=True` and provide `original_image` |
| Holes not filled | Increase `morph_iterations` |
| Missing small regions | Reduce threshold in `canny_low_threshold` |

---

## Full Example Workflow

```python
from ultralytics import YOLO
from yolov8_mask_integration import YOLOv8MaskIntegration
from mask_refinement_pipeline import RefinementConfig
import cv2
from pathlib import Path

# 1. Run YOLOv8
model = YOLO('yolov8-seg.pt')
results = model.predict('chair.jpg')

# 2. Load image
image = cv2.imread('chair.jpg')

# 3. Initialize integration
integration = YOLOv8MaskIntegration()

# 4. Analyze and auto-tune
config = integration.suggest_parameters(image)

# 5. Create customized pipeline
from mask_refinement_pipeline import MaskRefinementPipeline
pipeline = MaskRefinementPipeline(config)

# 6. Refine masks
refined = pipeline.refine_masks_batch(
    integration.extract_masks_from_yolo_results(
        results[0], image.shape[:2]
    ),
    original_image=image,
    align_with_edges=True
)

# 7. Visualize
pipeline.visualize_masks(image, refined)

# 8. Save
saved = pipeline.save_masks(refined)

# 9. Assess quality
if 'seat' in refined:
    orig = integration.extract_masks_from_yolo_results(results[0], image.shape[:2])
    metrics = integration.calculate_mask_quality_score(orig['seat'], refined['seat'])
    print(f"Quality metrics: {metrics}")
```

---

## Performance Tips

1. **Reduce resolution**: Resize to 512x512 or smaller
2. **Skip edge alignment**: Remove for 2x speedup
3. **Smaller parameters**: Use `morph_kernel_size=3`, faster ops
4. **Batch processing**: Process multiple images at once
5. **Disable visualization**: Set `visualize=False` in config

---

## Running Tests/Demo

```bash
# Run all demos and generate visualizations
python mask_refinement_demo.py

# Outputs:
# - 01_before_after_comparison.png
# - 02_parameter_effects.png
# - 03_edge_alignment.png
# - 04_adaptive_tuning.png
# - 05_quality_metrics.png
```

---

## Common Issues & Solutions

### Masks are pixelated/blocky
```python
# Increase blur and contour approximation
config.blur_radius = 7
config.contour_epsilon_factor = 0.02
```

### Holes in mask not filling
```python
# Increase morphological iterations
config.morph_iterations = 3

# Or use higher kernel size
config.morph_kernel_size = 7
```

### Mask boundaries don't match image edges
```python
# Enable edge alignment
refined = pipeline.refine_mask(mask, image, align_with_edges=True)

# Lower threshold for edge detection
config.canny_low_threshold = 30
config.canny_high_threshold = 80
```

### Memory issues with large images
```python
# Resize mask before processing
target_size = (512, 512)
refined = pipeline.refine_mask(mask, image, target_shape=target_size)
```

---

## Key Classes & Methods

### MaskRefinementPipeline
- `refine_mask()` - Single mask
- `refine_masks_batch()` - Multiple masks
- `visualize_masks()` - Overlay visualization
- `save_masks()` - Save to disk
- `load_mask()` / `load_image()` - File I/O

### YOLOv8MaskIntegration
- `refine_yolo_masks()` - YOLOv8 → refined
- `suggest_parameters()` - Auto-tune config
- `analyze_image_characteristics()` - Image analysis
- `calculate_mask_quality_score()` - Quality metrics
- `process_image_folder()` - Batch processing

### RefinementConfig
- `morph_kernel_size` - Morphological kernel
- `morph_iterations` - Repeat count
- `blur_radius` - Gaussian blur size
- `contour_epsilon_factor` - Contour smoothing
- `canny_low_threshold` / `high_threshold` - Edge detection
- `edge_dilation_kernel` - Edge line thickness

---

## Output Interpretation

### Visualization Colors
- **Green overlay**: Refined mask applied to image
- **Gray**: Binary mask representation
- **Contours**: Mask boundaries

### Quality Metrics
- `smoothness_improvement` > 0: Edges are smoother
- `area_preservation` ≈ 1.0: Area well preserved
- `simplification_ratio` < 1.0: Contour simplified

---

**Version:** 1.0.0  
**Last Updated:** February 2026
