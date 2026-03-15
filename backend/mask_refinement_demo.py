"""
Mask Refinement Pipeline - Test and Demo Script

This script demonstrates the complete mask refinement pipeline with:
- Synthetic mask generation for testing
- Visual comparison before/after
- Parameter tuning effects
- Batch processing demo
- Performance metrics

Run this script to see the pipeline in action:
    python mask_refinement_demo.py

Author: DesignableAI
Date: 2026
"""

import cv2
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import logging
from typing import Dict

from mask_refinement_pipeline import MaskRefinementPipeline, RefinementConfig
from yolov8_mask_integration import YOLOv8MaskIntegration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MaskRefinementDemo:
    """
    Interactive demonstration of the mask refinement pipeline.
    """
    
    def __init__(self, output_dir: Path = Path("./demo_output")):
        """Initialize demo."""
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.pipeline = MaskRefinementPipeline()
        self.integration = YOLOv8MaskIntegration()
    
    # ==================== SYNTHETIC MASK GENERATION ====================
    
    def generate_synthetic_chair(self) -> tuple:
        """
        Generate a synthetic chair image and rough segmentation masks.
        
        Returns:
            Tuple of (image, masks_dict)
        """
        logger.info("Generating synthetic chair image and masks...")
        
        # Create image
        image = np.ones((512, 512, 3), dtype=np.uint8) * 240
        
        # Add some texture and lighting
        x = np.linspace(0, 1, 512)
        y = np.linspace(0, 1, 512)
        X, Y = np.meshgrid(x, y)
        texture = (50 * np.sin(X * 10) * np.cos(Y * 10)).astype(np.uint8)
        image[:, :, 0] = np.clip(image[:, :, 0] - texture, 0, 255)
        image[:, :, 1] = np.clip(image[:, :, 1] - texture // 2, 0, 255)
        
        # Create masks with intentionally rough edges
        masks = {}
        
        # Seat mask (rectangular)
        seat_mask = np.zeros((512, 512), dtype=np.uint8)
        cv2.rectangle(seat_mask, (100, 250), (400, 350), 1, -1)
        # Add noise to create rough edges
        noise = np.random.randint(0, 2, (512, 512), dtype=np.uint8)
        seat_mask = np.logical_and(seat_mask, np.logical_not(noise)).astype(np.uint8)
        masks['seat'] = seat_mask
        
        # Backrest mask (upper rectangular)
        backrest_mask = np.zeros((512, 512), dtype=np.uint8)
        cv2.rectangle(backrest_mask, (150, 100), (350, 250), 1, -1)
        noise = np.random.randint(0, 2, (512, 512), dtype=np.uint8)
        backrest_mask = np.logical_and(backrest_mask, np.logical_not(noise)).astype(np.uint8)
        masks['backrest'] = backrest_mask
        
        # Arms masks (left and right)
        arms_mask = np.zeros((512, 512), dtype=np.uint8)
        cv2.ellipse(arms_mask, (80, 200), (40, 60), 0, 0, 360, 1, -1)
        cv2.ellipse(arms_mask, (420, 200), (40, 60), 0, 0, 360, 1, -1)
        noise = np.random.randint(0, 2, (512, 512), dtype=np.uint8)
        arms_mask = np.logical_and(arms_mask, np.logical_not(noise)).astype(np.uint8)
        masks['arms'] = arms_mask
        
        # Base mask (bottom rectangular)
        base_mask = np.zeros((512, 512), dtype=np.uint8)
        cv2.rectangle(base_mask, (120, 350), (380, 420), 1, -1)
        noise = np.random.randint(0, 3, (512, 512), dtype=np.uint8)
        base_mask = np.logical_and(base_mask, np.logical_not(noise)).astype(np.uint8)
        masks['base'] = base_mask
        
        logger.info(f"Generated synthetic chair with masks: {list(masks.keys())}")
        
        return image, masks
    
    # ==================== DEMO 1: BEFORE/AFTER COMPARISON ====================
    
    def demo_before_after(self):
        """
        Demonstrate before/after mask refinement with visualization.
        """
        print("\n" + "=" * 70)
        print("DEMO 1: BEFORE/AFTER MASK REFINEMENT")
        print("=" * 70)
        
        # Generate synthetic data
        image, rough_masks = self.generate_synthetic_chair()
        
        # Refine masks
        refined_masks = self.pipeline.refine_masks_batch(
            rough_masks,
            original_image=image,
            align_with_edges=True
        )
        
        # Create comparison visualization
        n_parts = len(refined_masks)
        fig, axes = plt.subplots(n_parts, 3, figsize=(15, 5 * n_parts))
        
        if n_parts == 1:
            axes = axes.reshape(1, -1)
        
        for idx, (part_name, refined_mask) in enumerate(refined_masks.items()):
            rough_mask = rough_masks[part_name]
            
            # Original mask
            axes[idx, 0].imshow(rough_mask, cmap='gray')
            axes[idx, 0].set_title(f'{part_name.upper()} - Original (Rough)')
            axes[idx, 0].axis('off')
            
            # Refined mask
            axes[idx, 1].imshow(refined_mask, cmap='gray')
            axes[idx, 1].set_title(f'{part_name.upper()} - Refined (Smooth)')
            axes[idx, 1].axis('off')
            
            # Overlay on chair
            overlay = image.copy().astype(np.float32)
            overlay[refined_mask > 0] = [0, 255, 0]
            axes[idx, 2].imshow(cv2.cvtColor(overlay.astype(np.uint8), cv2.COLOR_BGR2RGB))
            axes[idx, 2].set_title(f'{part_name.upper()} - Applied to Chair')
            axes[idx, 2].axis('off')
        
        plt.tight_layout()
        output_path = self.output_dir / "01_before_after_comparison.png"
        plt.savefig(output_path, dpi=100, bbox_inches='tight')
        logger.info(f"Saved comparison to {output_path}")
        plt.close()
    
    # ==================== DEMO 2: PARAMETER EFFECTS ====================
    
    def demo_parameter_effects(self):
        """
        Demonstrate how different parameters affect mask refinement.
        """
        print("\n" + "=" * 70)
        print("DEMO 2: PARAMETER TUNING EFFECTS")
        print("=" * 70)
        
        image, rough_masks = self.generate_synthetic_chair()
        seat_mask = rough_masks['seat']
        
        # Test different configurations
        configs = [
            ("Light Smoothing", RefinementConfig(morph_kernel_size=3, blur_radius=3)),
            ("Medium Smoothing", RefinementConfig(morph_kernel_size=5, blur_radius=5)),
            ("Heavy Smoothing", RefinementConfig(morph_kernel_size=7, blur_radius=7)),
            ("Extra Heavy", RefinementConfig(morph_kernel_size=9, blur_radius=9)),
        ]
        
        fig, axes = plt.subplots(1, len(configs) + 1, figsize=(16, 4))
        
        # Original
        axes[0].imshow(seat_mask, cmap='gray')
        axes[0].set_title('Original Mask')
        axes[0].axis('off')
        
        # Refined with different parameters
        for idx, (config_name, config) in enumerate(configs):
            pipeline = MaskRefinementPipeline(config)
            refined = pipeline.refine_mask(
                seat_mask,
                original_image=image,
                align_with_edges=False
            )
            
            axes[idx + 1].imshow(refined, cmap='gray')
            axes[idx + 1].set_title(config_name)
            axes[idx + 1].axis('off')
            
            logger.info(f"Refined with {config_name}: kernel={config.morph_kernel_size}, blur={config.blur_radius}")
        
        plt.tight_layout()
        output_path = self.output_dir / "02_parameter_effects.png"
        plt.savefig(output_path, dpi=100, bbox_inches='tight')
        logger.info(f"Saved parameter effects to {output_path}")
        plt.close()
    
    # ==================== DEMO 3: EDGE ALIGNMENT ====================
    
    def demo_edge_alignment(self):
        """
        Demonstrate the effect of edge alignment.
        """
        print("\n" + "=" * 70)
        print("DEMO 3: EDGE ALIGNMENT EFFECTS")
        print("=" * 70)
        
        image, rough_masks = self.generate_synthetic_chair()
        
        # Refine without edge alignment
        pipeline_no_align = MaskRefinementPipeline()
        refined_no_align = pipeline_no_align.refine_mask(
            rough_masks['seat'],
            original_image=image,
            align_with_edges=False
        )
        
        # Refine with edge alignment
        refined_with_align = pipeline_no_align.refine_mask(
            rough_masks['seat'],
            original_image=image,
            align_with_edges=True
        )
        
        # Visualization
        fig, axes = plt.subplots(1, 4, figsize=(16, 4))
        
        axes[0].imshow(rough_masks['seat'], cmap='gray')
        axes[0].set_title('Original Mask')
        axes[0].axis('off')
        
        axes[1].imshow(refined_no_align, cmap='gray')
        axes[1].set_title('Refined (No Edge Alignment)')
        axes[1].axis('off')
        
        axes[2].imshow(refined_with_align, cmap='gray')
        axes[2].set_title('Refined (With Edge Alignment)')
        axes[2].axis('off')
        
        # Show edges detected in image
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        axes[3].imshow(edges, cmap='gray')
        axes[3].set_title('Detected Edges')
        axes[3].axis('off')
        
        plt.tight_layout()
        output_path = self.output_dir / "03_edge_alignment.png"
        plt.savefig(output_path, dpi=100, bbox_inches='tight')
        logger.info(f"Saved edge alignment demo to {output_path}")
        plt.close()
    
    # ==================== DEMO 4: ADAPTIVE TUNING ====================
    
    def demo_adaptive_tuning(self):
        """
        Demonstrate automatic parameter suggestion based on image analysis.
        """
        print("\n" + "=" * 70)
        print("DEMO 4: ADAPTIVE PARAMETER TUNING")
        print("=" * 70)
        
        image, rough_masks = self.generate_synthetic_chair()
        
        # Analyze image and get suggested parameters
        metrics = self.integration.analyze_image_characteristics(image)
        config = self.integration.suggest_parameters(image)
        
        logger.info(f"Image metrics: {metrics}")
        logger.info(f"Suggested config: morph_kernel={config.morph_kernel_size}, "
                   f"blur={config.blur_radius}, epsilon={config.contour_epsilon_factor}")
        
        # Create comparison: default vs adaptive
        pipeline_default = MaskRefinementPipeline()
        pipeline_adaptive = MaskRefinementPipeline(config)
        
        refined_default = pipeline_default.refine_mask(
            rough_masks['seat'],
            original_image=image
        )
        refined_adaptive = pipeline_adaptive.refine_mask(
            rough_masks['seat'],
            original_image=image
        )
        
        # Visualization
        fig = plt.figure(figsize=(14, 10))
        
        # Metrics
        ax = plt.subplot(2, 3, 1)
        ax.text(0.1, 0.9, "Image Metrics:\n", fontsize=12, fontweight='bold',
               verticalalignment='top', transform=ax.transAxes)
        metrics_text = "\n".join([f"{k}: {v:.3f}" for k, v in metrics.items()])
        ax.text(0.1, 0.75, metrics_text, fontsize=10,
               verticalalignment='top', transform=ax.transAxes, family='monospace')
        ax.axis('off')
        
        # Config comparison
        ax = plt.subplot(2, 3, 2)
        config_text = (f"Default Config:\n"
                      f"  kernel: {MaskRefinementConfig().morph_kernel_size}\n"
                      f"  blur: {MaskRefinementConfig().blur_radius}\n"
                      f"\nAdaptive Config:\n"
                      f"  kernel: {config.morph_kernel_size}\n"
                      f"  blur: {config.blur_radius}")
        ax.text(0.1, 0.9, config_text, fontsize=10,
               verticalalignment='top', transform=ax.transAxes, family='monospace')
        ax.axis('off')
        
        # Masks comparison
        ax = plt.subplot(2, 3, 4)
        ax.imshow(refined_default, cmap='gray')
        ax.set_title('Default Parameters')
        ax.axis('off')
        
        ax = plt.subplot(2, 3, 5)
        ax.imshow(refined_adaptive, cmap='gray')
        ax.set_title('Adaptive Parameters')
        ax.axis('off')
        
        # Difference
        ax = plt.subplot(2, 3, 6)
        diff = cv2.absdiff(refined_default, refined_adaptive)
        ax.imshow(diff, cmap='hot')
        ax.set_title('Difference')
        ax.axis('off')
        
        plt.tight_layout()
        output_path = self.output_dir / "04_adaptive_tuning.png"
        plt.savefig(output_path, dpi=100, bbox_inches='tight')
        logger.info(f"Saved adaptive tuning demo to {output_path}")
        plt.close()
    
    # ==================== DEMO 5: QUALITY METRICS ====================
    
    def demo_quality_metrics(self):
        """
        Demonstrate quality assessment metrics.
        """
        print("\n" + "=" * 70)
        print("DEMO 5: QUALITY METRICS ASSESSMENT")
        print("=" * 70)
        
        image, rough_masks = self.generate_synthetic_chair()
        
        # Refine all masks and calculate metrics
        quality_report = {}
        
        for part_name, rough_mask in rough_masks.items():
            refined_mask = self.pipeline.refine_mask(
                rough_mask,
                original_image=image
            )
            
            metrics = self.integration.calculate_mask_quality_score(
                rough_mask,
                refined_mask
            )
            
            quality_report[part_name] = metrics
            logger.info(f"{part_name}: {metrics}")
        
        # Visualization
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        
        # Smoothness improvement
        parts = list(quality_report.keys())
        smoothness = [quality_report[p].get('smoothness_improvement', 0) for p in parts]
        axes[0].bar(parts, smoothness)
        axes[0].set_title('Smoothness Improvement')
        axes[0].set_ylabel('Perimeter/Area Reduction')
        axes[0].tick_params(axis='x', rotation=45)
        
        # Area preservation
        area_pres = [quality_report[p].get('area_preservation', 1.0) for p in parts]
        axes[1].bar(parts, area_pres)
        axes[1].set_title('Area Preservation')
        axes[1].set_ylabel('Ratio (refined / original)')
        axes[1].axhline(y=1.0, color='r', linestyle='--', label='100%')
        axes[1].legend()
        axes[1].tick_params(axis='x', rotation=45)
        
        # Simplification ratio
        simplify = [quality_report[p].get('simplification_ratio', 1.0) for p in parts]
        axes[2].bar(parts, simplify)
        axes[2].set_title('Contour Simplification')
        axes[2].set_ylabel('Points Ratio (refined / original)')
        axes[2].tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        output_path = self.output_dir / "05_quality_metrics.png"
        plt.savefig(output_path, dpi=100, bbox_inches='tight')
        logger.info(f"Saved quality metrics to {output_path}")
        plt.close()
    
    # ==================== RUN ALL DEMOS ====================
    
    def run_all_demos(self):
        """
        Run all demonstration examples.
        """
        print("\n" + "=" * 70)
        print("MASK REFINEMENT PIPELINE - COMPREHENSIVE DEMO")
        print("=" * 70)
        print(f"Output directory: {self.output_dir}")
        
        try:
            self.demo_before_after()
            self.demo_parameter_effects()
            self.demo_edge_alignment()
            self.demo_adaptive_tuning()
            self.demo_quality_metrics()
            
            print("\n" + "=" * 70)
            print("ALL DEMOS COMPLETED SUCCESSFULLY!")
            print("=" * 70)
            print(f"Output files saved to: {self.output_dir}")
            
        except Exception as e:
            logger.error(f"Error running demos: {e}", exc_info=True)


# Helper to avoid NameError
class MaskRefinementConfig(RefinementConfig):
    """Alias for backward compatibility."""
    pass


# ==================== MAIN ====================

if __name__ == "__main__":
    # Create demo instance
    demo = MaskRefinementDemo()
    
    # Run all demonstrations
    demo.run_all_demos()
    
    # Print summary
    print("\n" + "=" * 70)
    print("TO USE THIS PIPELINE IN YOUR PROJECT:")
    print("=" * 70)
    print("""
1. Basic usage:
   from mask_refinement_pipeline import MaskRefinementPipeline
   
   pipeline = MaskRefinementPipeline()
   refined_mask = pipeline.refine_mask(your_mask, your_image)

2. Batch processing:
   refined_masks = pipeline.refine_masks_batch(masks_dict, your_image)

3. YOLOv8 integration:
   from yolov8_mask_integration import YOLOv8MaskIntegration
   
   integration = YOLOv8MaskIntegration()
   refined_masks = integration.refine_yolo_masks(yolo_results, image)

4. Adaptive tuning:
   config = integration.suggest_parameters(image)
   custom_pipeline = MaskRefinementPipeline(config)
    """)
    print("=" * 70 + "\n")
