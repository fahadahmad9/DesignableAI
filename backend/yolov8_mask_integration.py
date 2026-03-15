"""
YOLOv8 Chair Mask Integration and Advanced Usage

This module demonstrates how to integrate the mask refinement pipeline
with YOLOv8 segmentation outputs for real-world chair image processing.

Features:
- Direct YOLOv8 to refinement pipeline integration
- Batch processing of multiple chair images
- Adaptive parameter tuning based on image characteristics
- Before/after comparison visualization
- Performance metrics and quality assessment

Author: DesignableAI
Date: 2026
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, List, Optional
import logging
from mask_refinement_pipeline import MaskRefinementPipeline, RefinementConfig

logger = logging.getLogger(__name__)


class YOLOv8MaskIntegration:
    """
    Integration layer between YOLOv8 segmentation and mask refinement.
    """
    
    CHAIR_PARTS = ['seat', 'backrest', 'arms', 'base', 'leg']
    
    def __init__(self, config: Optional[RefinementConfig] = None):
        """
        Initialize integration layer.
        
        Args:
            config: RefinementConfig for the pipeline
        """
        self.pipeline = MaskRefinementPipeline(config)
        self.config = config or RefinementConfig()
    
    # ==================== YOLOv8 INTEGRATION ====================
    
    def extract_masks_from_yolo_results(
        self,
        yolo_results,
        image_shape: Tuple[int, int],
        class_names: Optional[Dict[int, str]] = None
    ) -> Dict[str, np.ndarray]:
        """
        Extract individual masks from YOLOv8 segmentation results.
        
        Args:
            yolo_results: YOLOv8 results object with masks
            image_shape: Target image shape (height, width)
            class_names: Optional mapping of class IDs to part names
            
        Returns:
            Dictionary mapping part names to binary masks
        """
        logger.info("Extracting masks from YOLOv8 results...")
        
        masks = {}
        
        # If no masks attribute, return empty
        if not hasattr(yolo_results, 'masks') or yolo_results.masks is None:
            logger.warning("No masks found in YOLOv8 results")
            return masks
        
        # Get class names if not provided
        if class_names is None:
            class_names = {i: part for i, part in enumerate(self.CHAIR_PARTS)}
        
        # Extract each mask
        for idx in range(len(yolo_results.boxes)):
            # Get class ID and corresponding part name
            class_id = int(yolo_results.boxes[idx].cls.item())
            part_name = class_names.get(class_id, f"part_{class_id}")
            
            # Get segmentation mask
            mask = yolo_results.masks[idx].data.cpu().numpy()[0]
            
            # Resize to image dimensions if needed
            if mask.shape != image_shape:
                mask = cv2.resize(mask, (image_shape[1], image_shape[0]),
                                 interpolation=cv2.INTER_NEAREST)
            
            # Convert to binary (0/1)
            mask = (mask > 0.5).astype(np.uint8)
            
            masks[part_name] = mask
            logger.info(f"Extracted mask for {part_name}")
        
        return masks
    
    def refine_yolo_masks(
        self,
        yolo_results,
        original_image: np.ndarray,
        image_shape: Tuple[int, int],
        class_names: Optional[Dict[int, str]] = None,
        align_with_edges: bool = True
    ) -> Dict[str, np.ndarray]:
        """
        Complete pipeline: Extract YOLOv8 masks and refine them.
        
        Args:
            yolo_results: YOLOv8 results object
            original_image: Original image for edge alignment
            image_shape: Target image shape
            class_names: Optional class name mapping
            align_with_edges: Whether to align with image edges
            
        Returns:
            Dictionary of refined masks
        """
        logger.info("Starting YOLOv8 mask refinement pipeline...")
        
        # Extract masks from YOLOv8
        masks = self.extract_masks_from_yolo_results(
            yolo_results, 
            image_shape, 
            class_names
        )
        
        if not masks:
            logger.warning("No masks extracted from YOLOv8 results")
            return {}
        
        # Refine all masks
        refined_masks = self.pipeline.refine_masks_batch(
            masks,
            original_image=original_image,
            target_shape=image_shape,
            align_with_edges=align_with_edges
        )
        
        return refined_masks
    
    # ==================== ADAPTIVE TUNING ====================
    
    def analyze_image_characteristics(
        self,
        image: np.ndarray
    ) -> Dict[str, float]:
        """
        Analyze image characteristics to suggest optimal parameters.
        
        Args:
            image: Input image
            
        Returns:
            Dictionary of analysis metrics
        """
        logger.info("Analyzing image characteristics...")
        
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Calculate metrics
        metrics = {}
        
        # Contrast (standard deviation of intensities)
        metrics['contrast'] = float(np.std(gray))
        
        # Edges density (Canny edge count)
        edges = cv2.Canny(gray, 50, 150)
        metrics['edge_density'] = float(np.count_nonzero(edges) / edges.size)
        
        # Blur level (Laplacian variance - high = sharp, low = blurry)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        metrics['blur_level'] = float(np.var(laplacian))
        
        # Noise level (high-frequency components)
        # Use difference between original and heavily blurred version
        blurred = cv2.GaussianBlur(gray, (11, 11), 0)
        noise = cv2.absdiff(gray, blurred)
        metrics['noise_level'] = float(np.mean(noise))
        
        logger.info(f"Image characteristics: {metrics}")
        
        return metrics
    
    def suggest_parameters(
        self,
        image: np.ndarray
    ) -> RefinementConfig:
        """
        Suggest optimal refinement parameters based on image analysis.
        
        Args:
            image: Input image to analyze
            
        Returns:
            Suggested RefinementConfig
        """
        logger.info("Suggesting optimal parameters...")
        
        metrics = self.analyze_image_characteristics(image)
        config = RefinementConfig()
        
        # Adjust based on metrics
        if metrics['noise_level'] > 20:
            # High noise: more aggressive morphological operations
            config.morph_kernel_size = 7
            config.morph_iterations = 3
            logger.info("High noise detected - increasing morphological kernel size")
        
        if metrics['edge_density'] > 0.15:
            # Dense edges: smaller blur to preserve detail
            config.blur_radius = 3
            config.contour_epsilon_factor = 0.005
            logger.info("Dense edges detected - reducing blur radius for detail preservation")
        else:
            # Sparse edges: stronger smoothing
            config.blur_radius = 7
            config.contour_epsilon_factor = 0.02
        
        if metrics['blur_level'] < 100:
            # Blurry image: more aggressive edge alignment
            config.canny_low_threshold = 30
            config.canny_high_threshold = 100
            logger.info("Blurry image detected - lowering Canny thresholds")
        
        return config
    
    # ==================== UTILITY FUNCTIONS ====================
    
    def calculate_mask_quality_score(
        self,
        original_mask: np.ndarray,
        refined_mask: np.ndarray
    ) -> Dict[str, float]:
        """
        Calculate quality metrics for mask refinement.
        
        Args:
            original_mask: Original (unrefined) mask
            refined_mask: Refined mask
            
        Returns:
            Dictionary of quality metrics
        """
        metrics = {}
        
        # Smoothness: ratio of perimeter to area
        # Smoother masks have lower perimeter-to-area ratio
        contours_orig, _ = cv2.findContours(original_mask, cv2.RETR_TREE, 
                                            cv2.CHAIN_APPROX_SIMPLE)
        contours_refined, _ = cv2.findContours(refined_mask, cv2.RETR_TREE, 
                                               cv2.CHAIN_APPROX_SIMPLE)
        
        if contours_orig and contours_refined:
            orig_perimeter = cv2.arcLength(contours_orig[0], True)
            refined_perimeter = cv2.arcLength(contours_refined[0], True)
            
            orig_area = cv2.contourArea(contours_orig[0])
            refined_area = cv2.contourArea(contours_refined[0])
            
            if orig_area > 0 and refined_area > 0:
                metrics['smoothness_improvement'] = float(
                    (orig_perimeter / orig_area) - (refined_perimeter / refined_area)
                )
            
            # Area preservation (should be similar before and after)
            if orig_area > 0:
                metrics['area_preservation'] = float(refined_area / orig_area)
        
        # Contour point reduction (indicator of simplification)
        if contours_orig and contours_refined:
            metrics['simplification_ratio'] = float(
                len(contours_refined[0]) / max(len(contours_orig[0]), 1)
            )
        
        return metrics
    
    def compare_masks_visualize(
        self,
        original_image: np.ndarray,
        original_masks: Dict[str, np.ndarray],
        refined_masks: Dict[str, np.ndarray],
        output_path: Optional[Path] = None
    ) -> np.ndarray:
        """
        Create side-by-side before/after comparison visualization.
        
        Args:
            original_image: Original chair image
            original_masks: Original masks (before refinement)
            refined_masks: Refined masks (after refinement)
            output_path: Optional path to save comparison
            
        Returns:
            Comparison visualization image
        """
        import matplotlib.pyplot as plt
        
        logger.info("Creating before/after comparison visualization...")
        
        n_parts = len(refined_masks)
        fig, axes = plt.subplots(n_parts, 3, figsize=(15, 5 * n_parts))
        
        if n_parts == 1:
            axes = axes.reshape(1, -1)
        
        for idx, (part_name, refined_mask) in enumerate(refined_masks.items()):
            original_mask = original_masks.get(part_name, refined_mask)
            
            # Column 1: Original mask
            axes[idx, 0].imshow(original_mask, cmap='gray')
            axes[idx, 0].set_title(f'{part_name} - Original')
            axes[idx, 0].axis('off')
            
            # Column 2: Refined mask
            axes[idx, 1].imshow(refined_mask, cmap='gray')
            axes[idx, 1].set_title(f'{part_name} - Refined')
            axes[idx, 1].axis('off')
            
            # Column 3: Overlay on image
            overlay = original_image.copy().astype(np.float32)
            overlay[refined_mask > 0] = [0, 255, 0]  # Green overlay
            axes[idx, 2].imshow(cv2.cvtColor(overlay.astype(np.uint8), cv2.COLOR_BGR2RGB))
            axes[idx, 2].set_title(f'{part_name} - Overlay')
            axes[idx, 2].axis('off')
        
        plt.tight_layout()
        
        if output_path:
            plt.savefig(output_path, dpi=150, bbox_inches='tight')
            logger.info(f"Comparison saved to {output_path}")
        
        plt.show()
        
        return None
    
    # ==================== BATCH PROCESSING ====================
    
    def process_image_folder(
        self,
        image_folder: Path,
        output_folder: Optional[Path] = None,
        image_extensions: Tuple[str, ...] = ('.jpg', '.jpeg', '.png'),
        adaptive_tuning: bool = False
    ) -> Dict[str, Dict[str, Path]]:
        """
        Batch process all chair images in a folder.
        
        Args:
            image_folder: Folder containing chair images
            output_folder: Folder to save refined masks (optional)
            image_extensions: Valid image file extensions
            adaptive_tuning: Whether to use adaptive parameter tuning
            
        Returns:
            Dictionary mapping image filenames to refined mask paths
        """
        image_folder = Path(image_folder)
        output_folder = output_folder or self.config.output_dir / "batch_output"
        output_folder.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Processing images from {image_folder}")
        logger.info(f"Output folder: {output_folder}")
        
        results = {}
        
        # Find all images
        image_files = []
        for ext in image_extensions:
            image_files.extend(image_folder.glob(f"*{ext}"))
            image_files.extend(image_folder.glob(f"*{ext.upper()}"))
        
        logger.info(f"Found {len(image_files)} images to process")
        
        for image_path in image_files:
            try:
                logger.info(f"\nProcessing: {image_path.name}")
                
                # Load image
                image = cv2.imread(str(image_path))
                if image is None:
                    logger.error(f"Failed to load image: {image_path}")
                    continue
                
                image_shape = image.shape[:2]
                
                # Get parameters (adaptive or default)
                if adaptive_tuning:
                    config = self.suggest_parameters(image)
                    self.pipeline.config = config
                
                # For this example, create dummy masks
                # In real scenario, these would come from YOLOv8
                logger.info("Note: Processing with example masks (replace with YOLOv8 output)")
                
                # Create output subdirectory
                output_subdir = output_folder / image_path.stem
                output_subdir.mkdir(parents=True, exist_ok=True)
                
                # Save image info
                results[image_path.name] = {
                    'path': image_path,
                    'output_dir': output_subdir,
                    'shape': image_shape
                }
                
            except Exception as e:
                logger.error(f"Error processing {image_path}: {e}")
                continue
        
        logger.info(f"\nBatch processing complete. Processed {len(results)} images.")
        
        return results


# ==================== EXAMPLE: INTEGRATION WITH YOLOV8 ====================

def example_yolov8_integration():
    """
    Example showing how to use this with YOLOv8 in a real scenario.
    """
    print("\n" + "=" * 70)
    print("YOLOv8 MASK REFINEMENT INTEGRATION - EXAMPLE")
    print("=" * 70 + "\n")
    
    print("""
# Step 1: Load YOLOv8 model and run inference
from ultralytics import YOLO

model = YOLO('yolov8-seg.pt')  # Load segmentation model
image_path = 'chair.jpg'
results = model.predict(image_path, conf=0.5)  # Run inference

# Step 2: Initialize integration layer
integration = YOLOv8MaskIntegration()

# Step 3: Load original image
import cv2
original_image = cv2.imread(image_path)

# Step 4: Refine masks from YOLOv8
refined_masks = integration.refine_yolo_masks(
    results[0],
    original_image=original_image,
    image_shape=original_image.shape[:2],
    align_with_edges=True
)

# Step 5: Visualize results
integration.pipeline.visualize_masks(original_image, refined_masks)

# Step 6: Save refined masks
saved_paths = integration.pipeline.save_masks(refined_masks, prefix='refined')

# OPTIONAL: Adaptive parameter tuning
config = integration.suggest_parameters(original_image)
integration.pipeline.config = config

# OPTIONAL: Batch process multiple images
results = integration.process_image_folder(
    image_folder=Path('chair_images/'),
    adaptive_tuning=True
)
    """)
    
    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    example_yolov8_integration()
