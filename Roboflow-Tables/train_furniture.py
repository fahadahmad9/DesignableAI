import os
from ultralytics import YOLO

def main():
    # 1. Define Paths
    dataset_config = r"C:\Users\fahad\Documents\DesignableAI\Roboflow-Tables\dataset\data.yaml"
    output_dir = r"C:\Users\fahad\Documents\DesignableAI\training_results"

    if not os.path.exists(dataset_config):
        print(f"❌ Error: data.yaml not found at {dataset_config}")
        return

    print("🚀 All set! Starting YOLOv8-Seg training on RTX 3050...")
    
    # 2. Load the segmentation model
    model = YOLO('yolov8n-seg.pt') 
    
    # 3. Start training
    model.train(
        data=dataset_config,
        epochs=100,
        imgsz=640,
        device=0,      # RTX 3050
        batch=8,       
        project=output_dir,
        name="designable_ai_v1",
        workers=4      # You can safely use 4 now
    )

if __name__ == '__main__':
    # This block is MANDATORY on Windows to avoid the RuntimeError you saw
    main()