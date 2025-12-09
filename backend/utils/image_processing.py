from google.cloud import vision
import os
import cv2
import torch
import matplotlib.pyplot as plt
import random
import numpy as np
import io
import math

# Initialize Google Cloud Vision client
client = vision.ImageAnnotatorClient()

# -------- SAM setup --------
#SAM_CHECKPOINT = "models/sam_vit_h_4b8939.pth"
#DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

#sam_model = sam_model_registry["vit_h"](checkpoint=SAM_CHECKPOINT).to(DEVICE)
#mask_generator = SamAutomaticMaskGenerator(sam_model)

def extract_text(image_path):
    """Extract text using Google Cloud Vision API"""
    
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}
    
    try:
        print(f"Reading image: {image_path}")
        
        # Read image file
        with open(image_path, "rb") as image_file:
            content = image_file.read()
        
        # Create image object
        image = vision.Image(content=content)
        
        print("Sending to Google Cloud Vision API...")
        
        # Use document_text_detection for better handling of text
        response = client.document_text_detection(image=image)
        
        if not response.text_annotations:
            print("No text found in image")
            return []  # Return empty array when no text found
        
        # Get the full text (first annotation contains all text in reading order)
        full_text = response.text_annotations[0].description if response.text_annotations else ""
        
        # Extract individual words/phrases with position info
        details = []
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        word_text = ''.join([symbol.text for symbol in word.symbols])
                        # Only include actual text (not empty or just punctuation)
                        if word_text.strip() and not word_text.strip().isspace():
                            # Get bounding box coordinates
                            vertices = word.bounding_box.vertices
                            xs = [vertex.x for vertex in vertices]
                            ys = [vertex.y for vertex in vertices]
                            bbox = {
                                "x": min(xs),
                                "y": min(ys),
                                "width": max(xs) - min(xs),
                                "height": max(ys) - min(ys),
                                "center_x": (min(xs) + max(xs)) / 2,
                                "center_y": (min(ys) + max(ys)) / 2
                            }
                            
                            confidence = word.confidence if word.confidence is not None else 0.0
                            details.append({
                                "text": word_text,
                                "confidence": confidence,
                                "bbox": bbox
                            })
        
        # Filter for measurements (text containing numbers)
        measurements = []
        for detail in details:
            text = detail["text"]
            # Check if the text contains numbers (potential measurements)
            if any(char.isdigit() for char in text):
                measurements.append(detail)
        
        #print(f"Found {len(measurements)} potential measurements in text")
        #return measurements  # Return measurements array directly

        print(f"Found {len(measurements)} potential measurements in text")

        return {
            "status": "success",
            "full_text": full_text,
            "details": details,           # all detected text
            "measurements": measurements, # only those with numbers
            "total_words": len(details)
        }

    
    except Exception as e:
        error_msg = f"Text extraction failed: {str(e)}"
        print(f"ERROR: {error_msg}")
        return {"error": error_msg}

def find_nearest_segment(measurement, segments, max_distance=100):
    """Find the nearest segment to a measurement based on center point distance"""
    measurement_center = (measurement["bbox"]["center_x"], measurement["bbox"]["center_y"])
    min_distance = float('inf')
    nearest_segment = None
    
    for segment in segments:
        # Get segment center
        segment_x = segment["bbox"][0] + segment["bbox"][2]/2
        segment_y = segment["bbox"][1] + segment["bbox"][3]/2
        
        # Calculate Euclidean distance between centers
        distance = math.sqrt(
            (measurement_center[0] - segment_x)**2 + 
            (measurement_center[1] - segment_y)**2
        )
        
        if distance < min_distance and distance <= max_distance:
            min_distance = distance
            nearest_segment = segment
    
    return nearest_segment, min_distance if nearest_segment else None

def match_measurements_to_segments(measurements, segments):
    """Match each measurement with its closest segment"""
    matched_pairs = []
    
    for measurement in measurements:
        nearest_segment, distance = find_nearest_segment(measurement, segments)
        if nearest_segment:
            matched_pairs.append({
                "measurement": measurement["text"],
                "segment_bbox": nearest_segment["bbox"],
                "distance": distance
            })
    
    return matched_pairs

def extract_segments(image_path: str):
    """Extract furniture components using contour hierarchy"""
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}
    
    try:
        print(f"Starting segmentation for: {image_path}")
        
        # Read and preprocess
        image = cv2.imread(image_path)
        if image is None:
            return {"error": "Failed to read image"}
        
        original_height, original_width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply bilateral filter to reduce noise while keeping edges
        gray = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Get measurements from text detection
        #measurements = extract_text(image_path)
        #if isinstance(measurements, dict) and "error" in measurements:
        #    print(f"Error in text extraction: {measurements['error']}")
        #    measurements = []  # Use empty array if there was an error
        #print(f"Found {len(measurements)} measurements")
        #print("Measurements found:", [m["text"] for m in measurements] if measurements else "None")

        text_result = extract_text(image_path)
        measurements = text_result.get("measurements", []) if isinstance(text_result, dict) else text_result
        print("Measurements found:", [m["text"] for m in measurements] if measurements else "None")

        
        # Adaptive thresholding
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 13, 3
        )
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        
        print(f"Starting with {len(measurements)} measurements")
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        
        print("Preprocessing complete")
        
        # Find contours with hierarchy
        contours, hierarchy = cv2.findContours(
            binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE
        )
        
        print(f"Found {len(contours)} contours")
        
        # Process contours
        segments = []
        image_area = original_width * original_height
        min_area_ratio = 0.003  # 0.3% of image
        max_area_ratio = 0.90
        
        for idx, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            area_ratio = area / image_area
            
            # Filter by area
            if area_ratio < min_area_ratio or area_ratio > max_area_ratio:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Skip very small dimensions
            if w < 15 or h < 15:
                continue
            
            # Calculate shape features
            aspect_ratio = max(w, h) / (min(w, h) + 1e-5)
            
            # Approximate contour to polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            num_vertices = len(approx)
            
            # Calculate extent (ratio of contour area to bounding box area)
            bbox_area = w * h
            extent = area / (bbox_area + 1e-5)
            
            # Furniture parts are typically rectangular with high extent
            if extent < 0.5:  # Too irregular
                continue
            
            # Classify based on position, size, and shape
            center_y = y + h / 2
            relative_y = center_y / original_height
            
            if aspect_ratio > 5:
                if w > h:  # Horizontal long element
                    component_type = "horizontal_support"
                else:  # Vertical long element
                    component_type = "leg"
            elif area_ratio > 0.25 and relative_y < 0.3:
                component_type = "table_top"
            elif area_ratio > 0.15 and relative_y > 0.3:
                component_type = "drawer_section"
            elif 2 < aspect_ratio < 4 and area_ratio < 0.1:
                component_type = "drawer"
            elif extent > 0.85 and num_vertices <= 6:
                component_type = "panel"
            else:
                component_type = "component"
            
            segments.append({
                "bbox": [int(x), int(y), int(w), int(h)],
                "area": int(area),
                "aspect_ratio": float(aspect_ratio),
                "extent": float(extent),
                "vertices": int(num_vertices),
                "component_type": component_type, 
                "predicted_iou": float(min(extent * 0.95, 0.92))
            })
        
        print(f"Extracted {len(segments)} raw segments")
        
        # Remove overlaps
        segments = remove_overlapping_segments_smart(segments)
        
        # Sort by area
        segments = sorted(segments, key=lambda x: x['area'], reverse=True)
        
        print(f"Final: {len(segments)} segments")
        
        # Link measurements to segments
        measurement_links = link_measurements_to_segments(measurements, segments)
        
        return {
            "status": "success",
            "num_segments": len(segments),
            "segments": segments,
            "measurements": measurements,
            "links": measurement_links,
            "method": "hierarchy_based_segmentation",
            "image_size": [original_width, original_height]
        }
    
    except Exception as e:
        print(f"SEGMENTATION ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"CV segmentation failed: {str(e)}"}

def remove_overlapping_segments_smart(segments, iou_threshold=0.6):
    """Remove overlapping segments intelligently"""
    if not segments:
        return segments
    
    # Sort by extent/rectangularity (better quality first)
    segments = sorted(segments, key=lambda x: x.get('extent', x.get('rectangularity', 0)), reverse=True)
    
    keep = []
    for seg1 in segments:
        x1, y1, w1, h1 = seg1['bbox']
        should_keep = True
        
        for seg2 in keep:
            x2, y2, w2, h2 = seg2['bbox']
            
            # Calculate overlap
            x_left = max(x1, x2)
            y_top = max(y1, y2)
            x_right = min(x1 + w1, x2 + w2)
            y_bottom = min(y1 + h1, y2 + h2)
            
            if x_right > x_left and y_bottom > y_top:
                intersection = (x_right - x_left) * (y_bottom - y_top)
                area1 = w1 * h1
                area2 = w2 * h2
                
                # If either box is mostly inside the other, it's a duplicate
                if intersection / area1 > iou_threshold or intersection / area2 > iou_threshold:
                    should_keep = False
                    break
        
        if should_keep:
            keep.append(seg1)
    
    return keep  

def visualize_segments(image_path, sam_output):
    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    plt.figure(figsize=(10, 8))
    plt.imshow(image_rgb)
    
    if not sam_output or "segments" not in sam_output:
        print("⚠️ No segments found in SAM output.")
        return  # safely exit

    for seg in sam_output["segments"]:
        x, y, w, h = seg["bbox"]
        color = [random.random(), random.random(), random.random()]
        rect = plt.Rectangle((x, y), w, h, fill=False, edgecolor=color, linewidth=2)
        plt.gca().add_patch(rect)
        plt.text(x, y - 5, f"{seg['predicted_iou']:.2f}", color=color, fontsize=8)
    
    plt.axis("off")
    plt.show() 

def link_measurements_to_segments(measurements, segments, max_distance=None):
    """
    Link measurements to their nearest segments based on center point distance.
    Prints detailed coordinate information for debugging.
    """
    if not measurements or not segments:
        print("No measurements or segments to link")
        return []

    # Print all measurements and their coordinates
    print("\nDEBUG - All Measurements:")
    for m in measurements:
        print(f"Text: {m['text']}")
        print(f"Bbox: {m['bbox']}")
        print(f"Center: ({m['bbox']['center_x']}, {m['bbox']['center_y']})")
        print("---")

    # Print all segments and their coordinates
    print("\nDEBUG - All Segments:")
    for i, s in enumerate(segments):
        bbox = s['bbox']
        center_x = bbox[0] + bbox[2]/2
        center_y = bbox[1] + bbox[3]/2
        print(f"Segment {i}: {s['component_type']}")
        print(f"Bbox: {bbox}")
        print(f"Center: ({center_x}, {center_y})")
        print("---")

    # Set a very lenient max_distance (500 pixels or auto-calculated)
    if max_distance is None:
        # Use the larger image dimension to calculate threshold
        img_w = max([seg["bbox"][0] + seg["bbox"][2] for seg in segments])
        img_h = max([seg["bbox"][1] + seg["bbox"][3] for seg in segments])
        max_distance = 500  # increased to 500px for more matches
        print(f"\nUsing max_distance: {max_distance}px")

    links = []

    for measurement in measurements:
        try:
            text = measurement["text"]
            m_center_x = measurement["bbox"]["center_x"]
            m_center_y = measurement["bbox"]["center_y"]
            
            best_match = None
            min_dist = float("inf")
            
            # Try to link to nearest segment
            for segment in segments:
                s_bbox = segment["bbox"]
                s_center_x = s_bbox[0] + s_bbox[2]/2
                s_center_y = s_bbox[1] + s_bbox[3]/2
                
                dist = math.sqrt(
                    (m_center_x - s_center_x)**2 + 
                    (m_center_y - s_center_y)**2
                )
                
                print(f"\nDEBUG - Distance check:")
                print(f"Measurement '{text}' at ({m_center_x}, {m_center_y})")
                print(f"to Segment {segment['component_type']} at ({s_center_x}, {s_center_y})")
                print(f"Distance: {dist}px")

                if dist < min_dist:
                    min_dist = dist
                    best_match = segment

            # Link to nearest segment if within threshold
            if best_match and min_dist <= max_distance:
                s_bbox = best_match["bbox"]
                s_center_x = s_bbox[0] + s_bbox[2]/2
                s_center_y = s_bbox[1] + s_bbox[3]/2
                
                links.append({
                    "measurement_text": text,
                    "measurement_bbox": measurement["bbox"],
                    "segment_type": best_match["component_type"],
                    "segment_bbox": best_match["bbox"],
                    "distance": round(min_dist, 2),
                    "connection": {
                        "measurement": [m_center_x, m_center_y],
                        "segment": [s_center_x, s_center_y]
                    }
                })
                print(f"\nLinked: {text} → {best_match['component_type']} (distance: {min_dist:.2f}px)")
            else:
                print(f"\nNo link created for '{text}' - min distance {min_dist:.2f}px > threshold {max_distance}px")

        except Exception as e:
            print(f"Error processing measurement '{text}': {str(e)}")
            continue

    print(f"\nTotal links created: {len(links)}")
    return links

