"""
sketch_preprocessing.py
=======================
Preprocessing pipeline for rough sketch images to improve segmentation quality.
Techniques: upscaling, contrast enhancement, morphological operations.
"""

import cv2
import numpy as np
from pathlib import Path


def preprocess_sketch_for_segmentation(image_path: str, upscale_factor: float = 2.0) -> np.ndarray:
    """
    Preprocesses a rough sketch image to improve YOLO segmentation.
    
    Steps:
    1. Read grayscale image
    2. Upscale for detail preservation
    3. Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    4. Adaptive thresholding for binary map
    5. Morphological closing to fill gaps in strokes
    6. Median blur to remove speckle
    
    Args:
        image_path: Path to the sketch image
        upscale_factor: Upscaling multiplier (default 2.0)
    
    Returns:
        Preprocessed image (3-channel BGR) ready for YOLO
    """
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Failed to read image: {image_path}")
    
    # Convert to grayscale for processing
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Upscale to preserve stroke detail
    h, w = gray.shape
    new_h, new_w = int(h * upscale_factor), int(w * upscale_factor)
    upscaled = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    
    # 2. Apply CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(upscaled)
    
    # 3. Adaptive thresholding to create binary map
    # This helps separate strokes from background
    binary = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2
    )
    
    # 4. Morphological operations to close gaps and thicken strokes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    
    # Closing: fill small holes in strokes
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Dilation: thicken strokes for better segmentation
    dilated = cv2.dilate(closed, kernel, iterations=1)
    
    # 5. Median blur to remove speckle noise
    denoised = cv2.medianBlur(dilated, 5)
    
    # Convert back to BGR for consistency with YOLO input
    result = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
    
    return result


def save_preprocessed_sketch(image_path: str, output_path: str, upscale_factor: float = 2.0) -> None:
    """
    Preprocesses a sketch and saves the result.
    
    Args:
        image_path: Input sketch image path
        output_path: Output preprocessed image path
        upscale_factor: Upscaling multiplier
    """
    preprocessed = preprocess_sketch_for_segmentation(image_path, upscale_factor)
    cv2.imwrite(output_path, preprocessed)


def apply_sketch_preprocessing_inplace(image_path: str, upscale_factor: float = 2.0) -> np.ndarray:
    """
    Applies preprocessing and returns the numpy array without saving to disk.
    
    Args:
        image_path: Path to the sketch image
        upscale_factor: Upscaling multiplier
    
    Returns:
        Preprocessed image array (3-channel BGR)
    """
    return preprocess_sketch_for_segmentation(image_path, upscale_factor)
