#!/usr/bin/env python3
"""Script to add the /upload-canvas-sketch endpoint to main.py"""

endpoint_code = """

@app.post("/upload-canvas-sketch")
async def upload_canvas_sketch(
    file: UploadFile,
    furniture_type: str = "chair",
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_id)
):
    '''
    Uploads a canvas sketch drawing as an image file, applies preprocessing,
    runs YOLO segmentation, and returns detailed analysis via Gemini.
    
    Flow:
    1. Save file to disk and database
    2. Apply sketch preprocessing (upscale, CLAHE, morphological ops)
    3. Run YOLO inference on preprocessed image
    4. Classify furniture type and parts
    5. Generate analysis via Gemini
    '''
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    
    # Build safe filename
    suffix = Path(file.filename).suffix or ".png"
    safe_name = f"user_{user_id}_{int(__import__('time').time())}_sketch_{file.filename}"
    save_path = UPLOAD_DIR / safe_name
    
    # Save original file to disk
    file_content = await file.read()
    with open(save_path, "wb") as f:
        f.write(file_content)
    
    # Save record to database
    upload_record = Upload(
        user_id=user_id,
        filename=file.filename,
        furniture_type=furniture_type,
        identified_type=None,  # Will be determined after analysis
        image_path=str(save_path),
    )
    db.add(upload_record)
    db.commit()
    db.refresh(upload_record)
    
    try:
        # Apply sketch preprocessing for better segmentation
        from sketch_preprocessing import apply_sketch_preprocessing_inplace
        
        selected_type = (furniture_type or "chair").strip().lower()
        if selected_type not in {"chair", "table"}:
            raise HTTPException(status_code=400, detail="furniture_type must be 'chair' or 'table'.")
        
        # Save preprocessed version to temp file
        preprocessed_img = apply_sketch_preprocessing_inplace(str(save_path), upscale_factor=2.0)
        preprocessed_path = str(save_path).replace(".png", "_preprocessed.png")
        preprocessed_path = preprocessed_path.replace(".jpg", "_preprocessed.jpg")
        cv2.imwrite(preprocessed_path, preprocessed_img)
        
        # Run inference on PREPROCESSED image
        detections = run_inference_on_image(
            preprocessed_path,
            conf_thresh=0.25,
            furniture_type=selected_type
        )
        
        # Extract seat metadata for measurement calibration
        seat_meta = _extract_seat_meta(detections)
        px_per_mm = compute_px_per_mm({}, seat_meta)
        
        # Classify furniture type
        if selected_type == "chair":
            parts_set = normalize_parts(detections)
            classification = classify_chair(parts_set)
            identified_type = classification["type"]
        else:
            parts_set = normalize_table_parts(detections)
            table_type, confidence = classify_table(parts_set)
            identified_type = table_type
        
        # Update database with identified type
        upload_record.identified_type = identified_type
        db.commit()
        
        # Build parts list with geometry analysis
        parts_with_traits = []
        img = cv2.imread(preprocessed_path)
        img_h, img_w = img.shape[:2] if img is not None else (800, 600)
        
        # Group detections by canonical part name
        label_instances = {}
        for det in detections:
            raw_name = det.get("part_name", "")
            mask_data = det.get("mask")
            canon = _canonicalize_part_name(raw_name, selected_type)
            if not canon or not mask_data:
                continue
            pts = np.array(mask_data, dtype=np.int32)
            cx = float(pts.reshape(-1, 2)[:, 0].mean()) if pts.size > 0 else 0
            if canon not in label_instances:
                label_instances[canon] = []
            label_instances[canon].append((det, cx))
        
        # Process parts with left/right suffixes for duplicates
        for canon, instances in label_instances.items():
            if len(instances) > 1:
                instances.sort(key=lambda x: x[1])
                suffixes = ["_left", "_right"] if len(instances) == 2 else [f"_{i+1}" for i in range(len(instances))]
            else:
                suffixes = [""]
            
            for (det, cx), suffix in zip(instances, suffixes):
                mask_data = det.get("mask")
                unique_label = canon + suffix
                
                geom = analyze_geometry(
                    mask_data,
                    img_h, img_w,
                    px_per_mm=px_per_mm,
                    img=img,
                    confidence=det.get("confidence", 0.5)
                )
                
                part_role = get_part_role(unique_label, furniture_type=selected_type)
                
                part_entry = {
                    "part_name": unique_label,
                    "role": part_role,
                    "mask": mask_data,
                    "confidence": round(det.get("confidence", 0.5), 3),
                    "bbox": geom.get("bbox", {}),
                    "area": geom.get("area", 0),
                    "centroid": geom.get("centroid", {}),
                    "major_axis": geom.get("major_axis", 0),
                    "minor_axis": geom.get("minor_axis", 0),
                }
                parts_with_traits.append(part_entry)
        
        # Build prompt for Gemini analysis
        if selected_type == "chair":
            prompt_payload = build_expert_prompt(
                {
                    "type": identified_type,
                    "parts": parts_with_traits,
                    "image_path": str(save_path),
                },
                current_phase="ANALYSIS",
            )
        else:
            context = build_table_prompt_context(parts_with_traits)
            prompt_payload = f"The user has uploaded a table sketch image. Here is the detected geometry and context:\\n\\n{context}\\n\\nPlease analyze this table design sketch."
        
        # Get analysis from Gemini
        session_id = f"sketch_{upload_record.id}_{uuid.uuid4()}"
        assistant_reply = call_designable_ai(session_id, prompt_payload)
        
        return {
            "assistant_reply": assistant_reply,
            "session_id": session_id,
            "furniture_type": selected_type,
            "identified_type": identified_type,
            "upload_id": upload_record.id,
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Clean up preprocessed file if it exists
        try:
            preprocessed_path = str(save_path).replace(".png", "_preprocessed.png")
            preprocessed_path = preprocessed_path.replace(".jpg", "_preprocessed.jpg")
            if Path(preprocessed_path).exists():
                Path(preprocessed_path).unlink()
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Canvas sketch analysis failed: {str(e)}")
"""

# Read the file
with open("main.py", "r") as f:
    content = f.read()

# Insert before if __name__ == '__main__':
new_content = content.replace(
    'if __name__ == "__main__":',
    endpoint_code + '\n\nif __name__ == "__main__":'
)

# Write back
with open("main.py", "w") as f:
    f.write(new_content)

print("Endpoint added successfully!")
