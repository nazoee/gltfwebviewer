
"use client";

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, useLayoutEffect } from 'react';
import type * as THREE_TYPES from 'three'; // For type-only import
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ModelViewerProps {
  modelFile: File | null;
  spotlightColor: string;
  backgroundColor: string;
  selectedPartColor: string;
  onPartSelect: (part: THREE.Object3D | null) => void;
  selectedPart: THREE.Object3D | null;
  className?: string;
  spotlightPosition: { x: number; y: number; z: number };
  setSpotlightPosition: (pos: { x: number; y: number; z: number }) => void;
  showLightHelper: boolean;
  spotlightIntensity: number;
}

export interface ModelViewerHandles {
  exportToImage: (scale?: number) => void;
  exportToGLB: () => void;
}

const ModelViewer = React.forwardRef<ModelViewerHandles, ModelViewerProps>(({
  modelFile,
  spotlightColor,
  backgroundColor,
  selectedPartColor,
  onPartSelect,
  selectedPart,
  className,
  spotlightPosition,
  setSpotlightPosition,
  showLightHelper,
  spotlightIntensity,
}, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const spotLightRef = useRef<THREE.SpotLight | null>(null);
  const spotLightHelperRef = useRef<THREE.SpotLightHelper | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster | null>(null);
  const mouseRef = useRef<THREE.Vector2 | null>(null);
  
  const gltfOriginalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());
  const activeMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map());

  const groundPlaneRef = useRef<THREE.Mesh | null>(null);

  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const dracoLoaderRef = useRef<DRACOLoader | null>(null);

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);


  useImperativeHandle(ref, () => ({
    exportToImage: (scale = 1) => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !mountRef.current) {
        toast({ title: "Export Error", description: "Renderer or scene not ready.", variant: "destructive" });
        return;
      }
      try {
        const originalWidth = mountRef.current.clientWidth;
        const originalHeight = mountRef.current.clientHeight;
        const targetWidth = Math.round(originalWidth * scale);
        const targetHeight = Math.round(originalHeight * scale);

        const currentPixelRatio = rendererRef.current.getPixelRatio();
        const originalAspect = cameraRef.current.aspect;

        rendererRef.current.setSize(targetWidth, targetHeight, false); // false = don't update style
        cameraRef.current.aspect = targetWidth / targetHeight;
        cameraRef.current.updateProjectionMatrix();
        
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        const dataURL = rendererRef.current.domElement.toDataURL('image/png');
        
        // Restore original settings
        rendererRef.current.setSize(originalWidth, originalHeight, false);
        rendererRef.current.setPixelRatio(currentPixelRatio); // Restore pixel ratio if it was changed
        cameraRef.current.aspect = originalAspect;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.render(sceneRef.current, cameraRef.current); // Render again at original size


        const link = document.createElement('a');
        link.download = `model_render_${targetWidth}x${targetHeight}.png`;
        link.href = dataURL;
        link.click();
        toast({ title: "Image Exported", description: `Render (${targetWidth}x${targetHeight}) captured successfully.` });
      } catch (error) {
        console.error("Error exporting image:", error);
        toast({ title: "Export Error", description: "Could not export image.", variant: "destructive" });
      }
    },
    exportToGLB: () => {
      if (!modelGroupRef.current) {
        toast({ title: "Export Error", description: "No model loaded to export.", variant: "destructive" });
        return;
      }
      const exporter = new GLTFExporter();
      const options = {
        binary: true, 
        trs: false,
        onlyVisible: true,
        truncateDrawRange: true,
        embedImages: true,
        animations: modelGroupRef.current.animations || []
      };

      // Ensure all current materials are correctly applied before export
      if(modelGroupRef.current && activeMaterialsRef.current.size > 0) {
        modelGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh && activeMaterialsRef.current.has(child.uuid)) {
            child.material = activeMaterialsRef.current.get(child.uuid)!;
          }
        });
      }


      exporter.parse(
        modelGroupRef.current,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'modified_model.glb';
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            toast({ title: "Model Exported", description: "GLB file saved successfully." });
          } else {
            toast({ title: "Export Error", description: "Unexpected export result type.", variant: "destructive" });
          }
        },
        (error: any) => {
          console.error('Error exporting GLTF:', error);
          toast({ title: "GLTF Export Error", description: `Failed to export model: ${error.message || error}`, variant: "destructive" });
        },
        options
      );
    }
  }));

  const adjustCameraAndLightsToModel = useCallback(() => {
    if (!modelGroupRef.current || !cameraRef.current || !controlsRef.current || !spotLightRef.current || !sceneRef.current) return;

    const box = new THREE.Box3().setFromObject(modelGroupRef.current);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) || 1; 
    let fitScale = 5 / maxDim; 
    if (maxDim === 0 || !Number.isFinite(fitScale)) { 
        fitScale = 1; 
    }
    
    modelGroupRef.current.scale.set(fitScale, fitScale, fitScale);
    
    // Recalculate box after scaling to get accurate center for repositioning
    const scaledBox = new THREE.Box3().setFromObject(modelGroupRef.current);
    modelGroupRef.current.position.sub(scaledBox.getCenter(new THREE.Vector3())); // Center model at origin

    cameraRef.current.position.set(0, scaledBox.getSize(new THREE.Vector3()).y * 0.75 , maxDim * fitScale * 1.5);
    controlsRef.current.target.copy(new THREE.Vector3(0,0,0)); // Target the new origin
    controlsRef.current.update();
    
    if (groundPlaneRef.current) {
        groundPlaneRef.current.position.y = scaledBox.min.y; // Adjust ground plane to new bottom of scaled model
    }
    
    const lightOffsetFactor = 1.5; 
    // Calculate light position relative to the scaled and centered model
    const lightX = scaledBox.max.x + size.x * fitScale * 0.2 * lightOffsetFactor; 
    const lightY = scaledBox.max.y + size.y * fitScale * 0.5 * lightOffsetFactor; 
    const lightZ = center.z + size.z * fitScale * lightOffsetFactor;       

    const newLightPos = { x: lightX, y: lightY, z: lightZ };

    if (setSpotlightPosition) { 
        setSpotlightPosition(newLightPos); // This will trigger the useEffect for spotlightPosition
    } else if (spotLightRef.current) { // Fallback if setSpotlightPosition is not provided (should not happen here)
        spotLightRef.current.position.set(newLightPos.x, newLightPos.y, newLightPos.z);
    }
    
    if (spotLightRef.current?.target) {
        spotLightRef.current.target.position.copy(new THREE.Vector3(0,0,0)); // Ensure light targets the origin
        spotLightRef.current.target.updateMatrixWorld();
    }
    if (spotLightHelperRef.current) spotLightHelperRef.current.update();

  }, [setSpotlightPosition]);


  // Scene Initialization
  useLayoutEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(backgroundColor);

    cameraRef.current = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    cameraRef.current.position.set(0, 1.5, 5);

    rendererRef.current = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rendererRef.current.setSize(width, height);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.shadowMap.enabled = true;
    rendererRef.current.outputColorSpace = THREE.SRGBColorSpace;
    currentMount.appendChild(rendererRef.current.domElement);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;

    ambientLightRef.current = new THREE.AmbientLight(0xffffff, 0.5);
    sceneRef.current.add(ambientLightRef.current);

    spotLightRef.current = new THREE.SpotLight(new THREE.Color(spotlightColor), spotlightIntensity);
    spotLightRef.current.angle = Math.PI / 6;
    spotLightRef.current.penumbra = 0.2;
    spotLightRef.current.distance = 50;
    spotLightRef.current.castShadow = true;
    spotLightRef.current.shadow.mapSize.width = 1024;
    spotLightRef.current.shadow.mapSize.height = 1024;
    spotLightRef.current.shadow.bias = -0.0001;
    sceneRef.current.add(spotLightRef.current);
    
    const spotLightTarget = new THREE.Object3D(); 
    spotLightTarget.position.set(0,0,0); 
    sceneRef.current.add(spotLightTarget);
    spotLightRef.current.target = spotLightTarget;
   
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    groundPlaneRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlaneRef.current.rotation.x = -Math.PI / 2;
    groundPlaneRef.current.position.y = -1; 
    groundPlaneRef.current.receiveShadow = true;
    sceneRef.current.add(groundPlaneRef.current);

    raycasterRef.current = new THREE.Raycaster();
    mouseRef.current = new THREE.Vector2();

    if (!dracoLoaderRef.current) {
        dracoLoaderRef.current = new DRACOLoader();
        dracoLoaderRef.current.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/');
    }
    if (!gltfLoaderRef.current) {
        gltfLoaderRef.current = new GLTFLoader();
        gltfLoaderRef.current.setDRACOLoader(dracoLoaderRef.current);
    }

    if (cameraRef.current && rendererRef.current && sceneRef.current) { 
        transformControlsRef.current = new TransformControls(cameraRef.current, rendererRef.current.domElement);
        transformControlsRef.current.userData = { isTransformControlRelated: true }; 
        sceneRef.current.add(transformControlsRef.current);
        transformControlsRef.current.setMode('translate');
        transformControlsRef.current.addEventListener('dragging-changed', (event) => {
            if (controlsRef.current) controlsRef.current.enabled = !event.value;
        });
        transformControlsRef.current.addEventListener('objectChange', () => {
             if (spotLightRef.current && setSpotlightPosition && transformControlsRef.current?.object === spotLightRef.current) {
                setSpotlightPosition({
                    x: spotLightRef.current.position.x,
                    y: spotLightRef.current.position.y,
                    z: spotLightRef.current.position.z,
                });
            }
        });
    }
    
    if (modelGroupRef.current && sceneRef.current && modelGroupRef.current.parent !== sceneRef.current) {
        sceneRef.current.add(modelGroupRef.current);
        adjustCameraAndLightsToModel();
    }

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controlsRef.current?.update();
      if(spotLightHelperRef.current?.visible) spotLightHelperRef.current.update(); 
      if (transformControlsRef.current?.object && spotLightHelperRef.current?.visible && spotLightRef.current) {
         if(transformControlsRef.current.object === spotLightRef.current) spotLightHelperRef.current.update();
      }
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current || !currentMount) return;
      const newWidth = currentMount.clientWidth;
      const newHeight = currentMount.clientHeight;
      rendererRef.current.setSize(newWidth, newHeight);
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => { 
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);

      transformControlsRef.current?.dispose();
      if (spotLightHelperRef.current && sceneRef.current?.children.includes(spotLightHelperRef.current)) {
        sceneRef.current.remove(spotLightHelperRef.current);
      }
      spotLightHelperRef.current?.dispose();
      spotLightHelperRef.current = null;

      controlsRef.current?.dispose();
      
      activeMaterialsRef.current.forEach((materialOrArray) => {
        const originalMat = gltfOriginalMaterialsRef.current.get( (materialOrArray as any)?.uuid || "" ); // Find original if possible
        if (materialOrArray !== originalMat && materialOrArray) { 
          if (Array.isArray(materialOrArray)) {
            materialOrArray.forEach(m => m.dispose());
          } else {
            (materialOrArray as THREE.Material).dispose();
          }
        }
      });
      activeMaterialsRef.current.clear();
      gltfOriginalMaterialsRef.current.clear();


      if (modelGroupRef.current && sceneRef.current?.children.includes(modelGroupRef.current)) {
         sceneRef.current.remove(modelGroupRef.current);
         modelGroupRef.current.traverse(obj => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                // Materials are now handled by activeMaterialsRef cleanup
            }
         });
      }
      modelGroupRef.current = null;


      if (spotLightRef.current && sceneRef.current?.children.includes(spotLightRef.current)) sceneRef.current.remove(spotLightRef.current);
      spotLightRef.current?.dispose();
      if (ambientLightRef.current && sceneRef.current?.children.includes(ambientLightRef.current)) sceneRef.current.remove(ambientLightRef.current);
      ambientLightRef.current?.dispose();
      if (groundPlaneRef.current && sceneRef.current?.children.includes(groundPlaneRef.current)) sceneRef.current.remove(groundPlaneRef.current);
      groundPlaneRef.current?.geometry?.dispose();
      (groundPlaneRef.current?.material as THREE.Material)?.dispose();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (currentMount.contains(rendererRef.current.domElement)) {
            currentMount.removeChild(rendererRef.current.domElement);
        }
      }
      sceneRef.current = null; // Explicitly nullify to help GC
      cameraRef.current = null;
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Update background color
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor]);

  // Update spotlight color
  useEffect(() => {
    if (spotLightRef.current) {
      spotLightRef.current.color.set(spotlightColor);
    }
  }, [spotlightColor]);

  // Update spotlight intensity
  useEffect(() => {
    if (spotLightRef.current) {
      spotLightRef.current.intensity = spotlightIntensity;
    }
  }, [spotlightIntensity]);
  
  // Update spotlight position from props (e.g., from UI or initial placement)
  useEffect(() => {
    if (spotLightRef.current && transformControlsRef.current && !transformControlsRef.current.dragging) {
        const currentInternalPos = spotLightRef.current.position;
        const epsilon = 1e-4; // Small tolerance for float comparison
        if (
            Math.abs(currentInternalPos.x - spotlightPosition.x) > epsilon ||
            Math.abs(currentInternalPos.y - spotlightPosition.y) > epsilon ||
            Math.abs(currentInternalPos.z - spotlightPosition.z) > epsilon
        ) {
            spotLightRef.current.position.set(spotlightPosition.x, spotlightPosition.y, spotlightPosition.z);
        }
        if (spotLightHelperRef.current?.visible) spotLightHelperRef.current.update();
        if(spotLightRef.current.target) spotLightRef.current.target.updateMatrixWorld();
    }
  }, [spotlightPosition]);

  // Manage light helper and transform controls visibility
  useEffect(() => {
    if (!transformControlsRef.current || !spotLightRef.current || !sceneRef.current) return;

    if (showLightHelper) {
        if (transformControlsRef.current.object !== spotLightRef.current) { // Attach only if not already attached
            transformControlsRef.current.attach(spotLightRef.current);
        }
        transformControlsRef.current.visible = true;
        transformControlsRef.current.enabled = true; // Ensure it's enabled
        
        if (!spotLightHelperRef.current) { // Create helper if it doesn't exist
            spotLightHelperRef.current = new THREE.SpotLightHelper(spotLightRef.current);
            sceneRef.current.add(spotLightHelperRef.current);
        } else { // If exists, ensure it's up-to-date and visible
            spotLightHelperRef.current.light = spotLightRef.current; 
            spotLightHelperRef.current.visible = true;
        }
        spotLightHelperRef.current.update(); // Always update after changes
    } else {
        if (transformControlsRef.current.object) { // Detach only if attached
            transformControlsRef.current.detach();
        }
        transformControlsRef.current.visible = false;
        transformControlsRef.current.enabled = false; // Disable when not shown
        if (spotLightHelperRef.current) {
            spotLightHelperRef.current.visible = false;
        }
    }
  }, [showLightHelper, spotLightRef, sceneRef, transformControlsRef]); // Dependencies for managing helper


  // Load GLTF Model
  useEffect(() => {
    if (!gltfLoaderRef.current || !sceneRef.current) { 
        if (modelFile && !isLoading) setIsLoading(true); // Only set loading if file exists and not already loading
        return;
    }
    const loader = gltfLoaderRef.current;

    if (!modelFile) {
      // Cleanup existing model and materials
      activeMaterialsRef.current.forEach((materialOrArray, uuid) => {
        const originalMat = gltfOriginalMaterialsRef.current.get(uuid);
        if (materialOrArray !== originalMat && materialOrArray) { // It's a clone we made
          if (Array.isArray(materialOrArray)) {
            materialOrArray.forEach(m => m.dispose());
          } else {
            (materialOrArray as THREE.Material).dispose();
          }
        }
      });
      if (modelGroupRef.current && sceneRef.current.children.includes(modelGroupRef.current)) {
        sceneRef.current.remove(modelGroupRef.current);
        // Traverse and dispose geometries
        modelGroupRef.current.traverse(obj => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry?.dispose();
                // Materials are handled by activeMaterialsRef cleanup
            }
        });
      }
      modelGroupRef.current = null;
      gltfOriginalMaterialsRef.current.clear();
      activeMaterialsRef.current.clear();
      if (onPartSelect) onPartSelect(null); // Reset selected part in parent
      setIsLoading(false); // Ensure loading is false
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      if (event.target?.result && loader && sceneRef.current) { // Ensure loader and scene are still valid
        // Clear previous model's materials first
        activeMaterialsRef.current.forEach((materialOrArray, uuid) => {
            const originalMat = gltfOriginalMaterialsRef.current.get(uuid);
            if (materialOrArray !== originalMat && materialOrArray) { 
                if (Array.isArray(materialOrArray)) materialOrArray.forEach(m => m.dispose());
                else (materialOrArray as THREE.Material).dispose();
            }
        });
        gltfOriginalMaterialsRef.current.clear();
        activeMaterialsRef.current.clear();

        // Remove old model if it exists
        if (modelGroupRef.current && sceneRef.current.children.includes(modelGroupRef.current)) {
             sceneRef.current.remove(modelGroupRef.current);
             // Dispose geometries of old model
             modelGroupRef.current.traverse(obj => {
                if (obj instanceof THREE.Mesh) obj.geometry?.dispose();
             });
        }
        modelGroupRef.current = null; // Reset model ref

        loader.parse(
          event.target.result as ArrayBuffer,
          '',
          (gltf) => {
            modelGroupRef.current = gltf.scene;
            modelGroupRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                const material = child.material; // This can be Material or Material[]
                gltfOriginalMaterialsRef.current.set(child.uuid, material); 
                activeMaterialsRef.current.set(child.uuid, material); 
              }
            });
            if(sceneRef.current) sceneRef.current.add(modelGroupRef.current); // Add to current scene
            adjustCameraAndLightsToModel(); 
            toast({ title: "Model loaded successfully!", description: "GLTF/GLB model processed." });
            setIsLoading(false);
            if (onPartSelect) onPartSelect(null); // Reset selected part
          },
          (error) => {
            console.error("Error parsing GLTF/GLB model:", error);
            toast({ title: "Error loading model", description: `Details: ${error.message || 'Unknown error'}.`, variant: "destructive" });
            setIsLoading(false);
          }
        );
      } else {
         toast({ title: "File Read Issue", description: "Could not get file content or loader not ready.", variant: "destructive" });
         setIsLoading(false);
      }
    };
    reader.onerror = () => {
        toast({ title: "Error Reading File", description: "An error occurred while trying to read the file.", variant: "destructive" });
        setIsLoading(false);
    };
    reader.readAsArrayBuffer(modelFile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelFile, toast, onPartSelect, adjustCameraAndLightsToModel]); 


  // Apply color to selected part
  useEffect(() => {
    const currentPart = selectedPart as THREE.Mesh | null;
    if (!currentPart || !modelGroupRef.current || !gltfOriginalMaterialsRef.current.has(currentPart.uuid)) {
      return;
    }
  
    const trueOriginalMaterialBase = gltfOriginalMaterialsRef.current.get(currentPart.uuid);
    if (!trueOriginalMaterialBase) return;
  
    const colorToApply = new THREE.Color(selectedPartColor);
  
    const cloneAndColorMaterial = (originalMat: THREE.Material): THREE.Material => {
      const clonedMat = originalMat.clone();
      if (clonedMat.hasOwnProperty('color') && (clonedMat as any).color?.isColor) {
        ((clonedMat as any).color as THREE.Color).set(colorToApply);
      } else if ( // Be more specific for common material types
        clonedMat instanceof THREE.MeshStandardMaterial ||
        clonedMat instanceof THREE.MeshBasicMaterial ||
        clonedMat instanceof THREE.MeshPhongMaterial ||
        clonedMat instanceof THREE.MeshLambertMaterial ||
        clonedMat instanceof THREE.MeshToonMaterial
      ) {
        (clonedMat as any).color = new THREE.Color(colorToApply);
      }
      return clonedMat;
    };
  
    let newColoredMaterial: THREE.Material | THREE.Material[];
    if (Array.isArray(trueOriginalMaterialBase)) {
      newColoredMaterial = trueOriginalMaterialBase.map(cloneAndColorMaterial);
    } else {
      newColoredMaterial = cloneAndColorMaterial(trueOriginalMaterialBase);
    }
  
    // Dispose previous *active* cloned material if it was a clone
    const previousActiveMaterial = activeMaterialsRef.current.get(currentPart.uuid);
    if (previousActiveMaterial && previousActiveMaterial !== trueOriginalMaterialBase && previousActiveMaterial !== newColoredMaterial) {
      // Check if it's different from the true original to confirm it's a clone we made
      const isPreviousAClone = previousActiveMaterial !== gltfOriginalMaterialsRef.current.get(currentPart.uuid);
      if (isPreviousAClone) {
        if (Array.isArray(previousActiveMaterial)) {
          previousActiveMaterial.forEach(m => m.dispose());
        } else {
          previousActiveMaterial.dispose();
        }
      }
    }
  
    currentPart.material = newColoredMaterial;
    activeMaterialsRef.current.set(currentPart.uuid, newColoredMaterial); // Store the new colored material as active
  
  }, [selectedPart, selectedPartColor]); // Only run when selected part or color changes


  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (transformControlsRef.current?.dragging) return; 
    if (!mountRef.current || !raycasterRef.current || !mouseRef.current || !cameraRef.current || !modelGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(modelGroupRef.current, true);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      // Ensure intersected object is a Mesh and part of the loaded model group
      if (intersectedObject instanceof THREE.Mesh && modelGroupRef.current.getObjectById(intersectedObject.id)) {
        if (onPartSelect) onPartSelect(intersectedObject);
      } else {
        if (onPartSelect) onPartSelect(null); // Clicked on something not a selectable mesh part
      }
    } else {
      if (onPartSelect) onPartSelect(null); // Clicked on empty space
    }
  };
  
  return (
    <div ref={mountRef} className={cn("w-full h-full relative cursor-grab active:cursor-grabbing", className)} onClick={handleCanvasClick}>
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="text-white text-xl">Loading Model...</div>
        </div>
      )}
       {!modelFile && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-muted-foreground text-lg p-8 bg-background/80 rounded-md shadow-lg">
            Upload a GLB/GLTF model to begin
          </p>
        </div>
      )}
    </div>
  );
});

ModelViewer.displayName = 'ModelViewer';
export default ModelViewer;
