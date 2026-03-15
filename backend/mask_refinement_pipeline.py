"""
Chair Mask Refinement Pipeline

This module processes YOLOv8 segmentation masks to produce clean, smooth,
professional-quality masks for each chair part (seat, backrest, arms, base).

Pipeline Steps:
1. Preprocess masks (ensure binary format, resize if needed)
2. Remove noise using morphological opening
3. Fill holes using morphological closing
4. Smooth edges using Gaussian blur
5. Extract and smooth contours using polygon approximation
6. Align boundaries with detected edges from the original image
7. Post-process and save masks

Author: DesignableAI
Date: 2026
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, List, Optional
from dataclasses import dataclass
import matplotlib.pyplot as plt
from PIL import Image
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class RefinementConfig:
    """Configuration parameters for mask refinement."""
    
    # Morphological operations
    morph_kernel_size: int = 5  # Size of morphological kernel (must be odd)
    morph_iterations: int = 2  # Number of iterations for open/close
    
    # Gaussian blur for smoothing
    blur_radius: int = 5  # Gaussian blur kernel size (must be odd)
    
    # Contour approximation
    contour_epsilon_factor: float = 0.01  # Approximation epsilon as fraction of contour perimeter
    
    # Edge alignment (Canny edge detection)
    canny_low_threshold: int = 50
    canny_high_threshold: int = 150
    edge_dilation_kernel: int = 3  # Dilate edges for better alignment
    
    # Visualization
    visualize: bool = True
    output_dir: Path = Path("./mask_outputs")


class MaskRefinementPipeline:
    """
    Complete pipeline for refining YOLOv8 segmentation masks.
    """
    
    def __init__(self, config: Optional[RefinementConfig] = None):
        """
        Initialize the pipeline with configuration.
        
        Args:
            config: RefinementConfig object with tuning parameters
        """
        self.config = config or RefinementConfig()
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Pipeline initialized with config: {self.config}")
    
    # ==================== STEP 1: PREPROCESSING ====================
    
    def preprocess_mask(
        self, 
        mask: np.ndarray, 
        target_shape: Optional[Tuple[int, int]] = None
    ) -> np.ndarray:
        """
        Preprocess mask: ensure binary format and resize if needed.
        
        Args:
            mask: Input mask (may be grayscale 0-255 or already binary)
            target_shape: Target shape (height, width) - if None, keeps original
            
        Returns:
            Binary mask (0 and 1 only)
        """
        logger.info("Step 1: Preprocessing mask...")
        
        # Convert to binary if not already
        if mask.dtype != np.uint8 or np.max(mask) > 1:
            _, mask = cv2.threshold(mask.astype(np.uint8), 127, 1, cv2.THRESH_BINARY)
        
        # Resize if target shape specified
        if target_shape is not None and mask.shape != target_shape:
            logger.info(f"Resizing mask from {mask.shape} to {target_shape}")
            mask = cv2.resize(mask, (target_shape[1], target_shape[0]), 
                            interpolation=cv2.INTER_NEAREST)
            # Ensure binary after resize
            _, mask = cv2.threshold(mask, 127, 1, cv2.THRESH_BINARY)
        
        return mask.astype(np.uint8)
    
    # ==================== STEP 2: NOISE REMOVAL ====================
    
    def remove_noise(self, mask: np.ndarray) -> np.ndarray:
        """
        Remove small noise using morphological opening (erosion -> dilation).
        
        Args:
            mask: Binary input mask
            
        Returns:
            Mask with noise removed
        """
        logger.info("Step 2: Removing noise with morphological opening...")
        
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (self.config.morph_kernel_size, self.config.morph_kernel_size)
        )
        
        # Morphological opening (removes small white noise)
        mask = cv2.morphologyEx(
            mask, 
            cv2.MORPH_OPEN, 
            kernel, 
            iterations=self.config.morph_iterations
        )
        
        return mask
    
    # ==================== STEP 3: HOLE FILLING ====================
    
    def fill_holes(self, mask: np.ndarray) -> np.ndarray:
        """
        Fill small holes using morphological closing (dilation -> erosion).
        
        Args:
            mask: Binary input mask
            
        Returns:
            Mask with holes filled
        """
        logger.info("Step 3: Filling holes with morphological closing...")
        
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (self.config.morph_kernel_size, self.config.morph_kernel_size)
        )
        
        # Morphological closing (fills small black holes)
        mask = cv2.morphologyEx(
            mask, 
            cv2.MORPH_CLOSE, 
            kernel, 
            iterations=self.config.morph_iterations
        )
        
        # Also use flood fill to ensure completely filled regions
        h, w = mask.shape
        seed_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
        cv2.floodFill(mask, seed_mask, (0, 0), 1)
        mask = cv2.bitwise_not(mask)
        
        return mask
    
    # ==================== STEP 4: EDGE SMOOTHING ====================
    
    def smooth_edges(self, mask: np.ndarray) -> np.ndarray:
        """
        Smooth edges using Gaussian blur.
        
        Args:
            mask: Binary input mask
            
        Returns:
            Mask with smoothed edges
        """
        logger.info("Step 4: Smoothing edges with Gaussian blur...")
        
        # Gaussian blur smooths jagged edges
        blurred = cv2.GaussianBlur(
            mask.astype(np.float32), 
            (self.config.blur_radius, self.config.blur_radius), 
            0
        )
        
        # Threshold to get binary mask again
        _, smoothed = cv2.threshold(blurred, 0.5, 1, cv2.THRESH_BINARY)
        
        return smoothed.astype(np.uint8)
    
    # ==================== STEP 5: CONTOUR SMOOTHING ====================
    
    def smooth_contours(self, mask: np.ndarray) -> np.ndarray:
        """
        Extract contours and smooth them using polygon approximation.
        This reduces jagged edges significantly.
        
        Args:
            mask: Binary input mask
            
        Returns:
            Mask with smoothed contours
        """
        logger.info("Step 5: Smoothing contours with polygon approximation...")
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        # Create empty mask for smooth contours
        smooth_mask = np.zeros_like(mask)
        
        if not contours:
            logger.warning("No contours found in mask!")
            return smooth_mask
        
        # Process each contour
        for contour in contours:
            # Calculate epsilon for contour approximation
            perimeter = cv2.arcLength(contour, True)
            epsilon = self.config.contour_epsilon_factor * perimeter
            
            # Approximate contour to reduce number of points (smoothing effect)
            approx_contour = cv2.approxPolyDP(contour, epsilon, True)
            
            # Draw the smoothed contour back
            cv2.drawContours(smooth_mask, [approx_contour], 0, 1, -1)
        
        logger.info(f"Processed {len(contours)} contour(s)")
        
        return smooth_mask
    
    # ==================== STEP 6: EDGE ALIGNMENT ====================
    
    def align_with_edges(
        self, 
        mask: np.ndarray, 
        original_image: np.ndarray
    ) -> np.ndarray:
        """
        Refine mask boundaries by snapping to detected edges in original image.
        This improves realism by aligning to actual image features.
        
        Args:
            mask: Refined binary mask
            original_image: Original image (for edge detection)
            
        Returns:
            Mask refined with edge alignment
        """
        logger.info("Step 6: Aligning boundaries with detected edges...")
        
        # Convert original image to grayscale if needed
        if len(original_image.shape) == 3:
            gray = cv2.cvtColor(original_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = original_image
        
        # Detect edges using Canny
        edges = cv2.Canny(
            gray, 
            self.config.canny_low_threshold, 
            self.config.canny_high_threshold
        )
        
        # Dilate edges to make them thicker (easier to align to)
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (self.config.edge_dilation_kernel, self.config.edge_dilation_kernel)
        )
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        # Combine: mask should align with strong edges
        # Enhance mask boundaries where edges are detected
        refined_mask = mask.copy()
        
        # Find edge pixels near mask boundary
        mask_boundary = cv2.Laplacian(mask.astype(np.float32), cv2.CV_32F)
        mask_boundary = np.abs(mask_boundary) > 0.1
        
        # Where both mask boundary and edges exist, strongly reinforce
        refined_mask = np.maximum(refined_mask, (mask_boundary & (edges > 0)).astype(np.uint8))
        
        # Ensure binary
        refined_mask = (refined_mask > 0).astype(np.uint8)
        
        return refined_mask
    
    # ==================== STEP 7: POSTPROCESSING ====================
    
    def postprocess_mask(self, mask: np.ndarray) -> np.ndarray:
        """
        Final postprocessing to ensure clean binary mask.
        
        Args:
            mask: Input mask
            
        Returns:
            Clean binary mask (0 and 1 only)
        """
        logger.info("Step 7: Postprocessing mask...")
        
        # Ensure binary
        mask = (mask > 0).astype(np.uint8)
        
        # Apply morphological closing to fill any remaining small gaps
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (3, 3)
        )
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
        
        logger.info(f"Mask stats - Min: {mask.min()}, Max: {mask.max()}, "
                   f"Non-zero pixels: {np.count_nonzero(mask)}")
        
        return mask
    
    # ==================== MAIN PIPELINE ====================
    
    def refine_mask(
        self,
        mask: np.ndarray,
        original_image: Optional[np.ndarray] = None,
        target_shape: Optional[Tuple[int, int]] = None,
        align_with_edges: bool = True
    ) -> np.ndarray:
        """
        Run the complete refinement pipeline on a single mask.
        
        Args:
            mask: Input segmentation mask
            original_image: Original image for edge alignment (optional)
            target_shape: Target shape to resize mask to (optional)
            align_with_edges: Whether to align with image edges (requires original_image)
            
        Returns:
            Refined, smooth, professional-quality mask
        """
        logger.info("=" * 60)
        logger.info("STARTING MASK REFINEMENT PIPELINE")
        logger.info("=" * 60)
        
        # Step 1: Preprocess
        mask = self.preprocess_mask(mask, target_shape)
        
        # Step 2: Remove noise
        mask = self.remove_noise(mask)
        
        # Step 3: Fill holes
        mask = self.fill_holes(mask)
        
        # Step 4: Smooth edges
        mask = self.smooth_edges(mask)
        
        # Step 5: Smooth contours
        mask = self.smooth_contours(mask)
        
        # Step 6: Align with image edges (if available)
        if align_with_edges and original_image is not None:
            mask = self.align_with_edges(mask, original_image)
        
        # Step 7: Postprocess
        mask = self.postprocess_mask(mask)
        
        logger.info("=" * 60)
        logger.info("PIPELINE COMPLETE")
        logger.info("=" * 60)
        
        return mask
    
    # ==================== BATCH PROCESSING ====================
    
    def refine_masks_batch(
        self,
        masks: Dict[str, np.ndarray],
        original_image: Optional[np.ndarray] = None,
        target_shape: Optional[Tuple[int, int]] = None,
        align_with_edges: bool = True
    ) -> Dict[str, np.ndarray]:
        """
        Process multiple masks (e.g., seat, backrest, arms, base).
        
        Args:
            masks: Dictionary mapping part names to mask arrays
            original_image: Original image for edge alignment
            target_shape: Target shape for all masks
            align_with_edges: Whether to align with image edges
            
        Returns:
            Dictionary mapping part names to refined masks
        """
        logger.info(f"Processing {len(masks)} masks in batch mode...")
        
        refined_masks = {}
        for part_name, mask in masks.items():
            logger.info(f"\nProcessing: {part_name}")
            refined_masks[part_name] = self.refine_mask(
                mask,
                original_image,
                target_shape,
                align_with_edges
            )
        
        return refined_masks
    
    # ==================== VISUALIZATION ====================
    
    def visualize_masks(
        self,
        original_image: np.ndarray,
        masks: Dict[str, np.ndarray],
        title: str = "Chair Segmentation Masks"
    ) -> np.ndarray:
        """
        Visualize masks overlaid on the original image with different colors.
        
        Args:
            original_image: Original chair image
            masks: Dictionary of masks to visualize
            title: Title for the figure
            
        Returns:
            Composite visualization image
        """
        logger.info("Creating visualization...")
        
        # Colors for different parts
        colors = {
            'seat': (0, 255, 0),        # Green
            'backrest': (255, 0, 0),    # Red
            'arms': (0, 0, 255),        # Blue
            'base': (255, 255, 0),      # Cyan
            'leg': (255, 0, 255),       # Magenta
        }
        
        # Create visualization
        vis_image = original_image.copy().astype(np.float32)
        
        for part_name, mask in masks.items():
            color = colors.get(part_name, (128, 128, 128))
            
            # Create colored overlay
            overlay = np.zeros_like(vis_image)
            overlay[mask > 0] = color
            
            # Blend with original (30% transparency)
            vis_image = cv2.addWeighted(vis_image, 0.7, overlay, 0.3, 0)
        
        # Draw contours for better visibility
        for part_name, mask in masks.items():
            color = colors.get(part_name, (128, 128, 128))
            contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(vis_image, contours, -1, color, 2)
        
        # Plot using matplotlib
        plt.figure(figsize=(12, 8))
        plt.title(title)
        plt.imshow(cv2.cvtColor(vis_image.astype(np.uint8), cv2.COLOR_BGR2RGB))
        plt.axis('off')
        
        # Save figure
        output_path = self.config.output_dir / "visualization.png"
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        logger.info(f"Visualization saved to {output_path}")
        plt.close()
        
        return vis_image.astype(np.uint8)
    
    # ==================== FILE I/O ====================
    
    def save_masks(
        self,
        masks: Dict[str, np.ndarray],
        prefix: str = "refined"
    ) -> Dict[str, Path]:
        """
        Save refined masks to disk as individual PNG files.
        
        Args:
            masks: Dictionary of masks to save
            prefix: Prefix for saved filenames
            
        Returns:
            Dictionary mapping part names to saved file paths
        """
        logger.info(f"Saving {len(masks)} masks to disk...")
        
        saved_paths = {}
        for part_name, mask in masks.items():
            # Convert to 8-bit image (0 and 255)
            mask_8bit = (mask * 255).astype(np.uint8)
            
            # Save
            filename = f"{prefix}_{part_name}.png"
            filepath = self.config.output_dir / filename
            cv2.imwrite(str(filepath), mask_8bit)
            
            saved_paths[part_name] = filepath
            logger.info(f"Saved {part_name} mask to {filepath}")
        
        return saved_paths
    
    def load_mask(self, filepath: str) -> np.ndarray:
        """
        Load mask from file.
        
        Args:
            filepath: Path to mask file
            
        Returns:
            Binary mask array
        """
        logger.info(f"Loading mask from {filepath}")
        mask = cv2.imread(filepath, cv2.IMREAD_GRAYSCALE)
        
        if mask is None:
            raise ValueError(f"Failed to load mask from {filepath}")
        
        # Convert to binary
        mask = (mask > 127).astype(np.uint8)
        
        return mask
    
    def load_image(self, filepath: str) -> np.ndarray:
        """
        Load image from file.
        
        Args:
            filepath: Path to image file
            
        Returns:
            Image array (BGR)
        """
        logger.info(f"Loading image from {filepath}")
        image = cv2.imread(filepath)
        
        if image is None:
            raise ValueError(f"Failed to load image from {filepath}")
        
        return image


# ==================== EXAMPLE USAGE ====================

def example_usage():
    """
    Example of how to use the MaskRefinementPipeline.
    """
    print("\n" + "=" * 70)
    print("MASK REFINEMENT PIPELINE - EXAMPLE USAGE")
    print("=" * 70 + "\n")
    
    # Create configuration with custom parameters
    config = RefinementConfig(
        morph_kernel_size=5,
        morph_iterations=2,
        blur_radius=5,
        contour_epsilon_factor=0.01,
        canny_low_threshold=50,
        canny_high_threshold=150,
        visualize=True,
        output_dir=Path("./mask_outputs")
    )
    
    # Initialize pipeline
    pipeline = MaskRefinementPipeline(config)
    
    # Example: Load and process masks
    print("Usage Example 1: Single mask refinement")
    print("-" * 70)
    print("""
    # Create or load a mask
    mask = np.zeros((512, 512), dtype=np.uint8)
    cv2.circle(mask, (256, 256), 100, 1, -1)  # Create circular mask
    
    # Create or load original image
    original_image = cv2.imread('chair.jpg')
    
    # Refine the mask
    refined_mask = pipeline.refine_mask(
        mask,
        original_image=original_image,
        target_shape=(512, 512),
        align_with_edges=True
    )
    """)
    
    print("\nUsage Example 2: Batch processing multiple parts")
    print("-" * 70)
    print("""
    # Create dictionary of masks (e.g., from YOLOv8)
    masks = {
        'seat': seat_mask,
        'backrest': backrest_mask,
        'arms': arms_mask,
        'base': base_mask
    }
    
    # Refine all masks
    refined_masks = pipeline.refine_masks_batch(
        masks,
        original_image=original_image,
        target_shape=(512, 512),
        align_with_edges=True
    )
    
    # Visualize results
    pipeline.visualize_masks(original_image, refined_masks)
    
    # Save refined masks
    saved_paths = pipeline.save_masks(refined_masks, prefix='refined')
    """)
    
    print("\nUsage Example 3: Custom configuration tuning")
    print("-" * 70)
    print("""
    # For more aggressive smoothing:
    config.morph_kernel_size = 7  # Larger kernel for stronger opening/closing
    config.blur_radius = 7         # Stronger blur
    config.contour_epsilon_factor = 0.02  # More aggressive approximation
    
    # For finer detail preservation:
    config.morph_kernel_size = 3   # Smaller kernel
    config.blur_radius = 3         # Less blur
    config.contour_epsilon_factor = 0.005  # Finer approximation
    """)
    
    print("\n" + "=" * 70 + "\n")


if __name__ == "__main__":
    example_usage()
