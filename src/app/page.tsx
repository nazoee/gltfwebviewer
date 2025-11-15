
"use client";

import React, { useState, useCallback, useRef } from 'react';
import type * as THREE_TYPES from 'three';
import ModelViewer, { type ModelViewerHandles } from '@/components/viewer/ModelViewer';
import ControlPanel from '@/components/viewer/ControlPanel';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Settings, Palette } from 'lucide-react';

export default function Home() {
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [spotlightColor, setSpotlightColor] = useState<string>('#FFFFFF');
  const [backgroundColor, setBackgroundColor] = useState<string>('#F0F0F0');
  const [selectedPartColor, setSelectedPartColor] = useState<string>('#FF0000');
  const [selectedPart, setSelectedPart] = useState<THREE_TYPES.Object3D | null>(null);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showLightHelper, setShowLightHelper] = useState(false);
  const [spotlightPosition, setSpotlightPositionState] = useState<{ x: number; y: number; z: number }>({ x: 5, y: 10, z: 7.5 });
  const [spotlightIntensity, setSpotlightIntensity] = useState<number>(10); // Default intensity
  const [exportImageScale, setExportImageScale] = useState<number>(1); // Default 1x scale


  const modelViewerRef = useRef<ModelViewerHandles>(null);

  const setSpotlightPosition = useCallback((pos: { x: number; y: number; z: number }) => {
    setSpotlightPositionState(pos);
  }, []);

  const handlePartSelect = useCallback((part: THREE_TYPES.Object3D | null) => {
    setSelectedPart(part);
    if (part && (part as any).material) {
      const currentMaterial = (part as any).material;
      let colorToSet = '#FF0000'; // Default if no color found

      if (Array.isArray(currentMaterial) && currentMaterial.length > 0) {
        // Handle array of materials (e.g., multi-material mesh)
        // Try to get color from the first material that has it
        for (const mat of currentMaterial) {
          if (mat.color && mat.color.isColor) {
            colorToSet = `#${mat.color.getHexString()}`;
            break;
          }
        }
      } else if (currentMaterial.color && currentMaterial.color.isColor) {
        // Handle single material
        colorToSet = `#${currentMaterial.color.getHexString()}`;
      }
      setSelectedPartColor(colorToSet);
    }
  }, [setSelectedPart, setSelectedPartColor]);


  const getSelectedPartName = () => {
    if (!selectedPart) return "None";
    return selectedPart.name || `Part (ID: ${selectedPart.id})`;
  }

  const handleExportImage = () => {
    modelViewerRef.current?.exportToImage(exportImageScale);
  };

  const handleExportGLB = () => {
    modelViewerRef.current?.exportToGLB();
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <ModelViewer
        ref={modelViewerRef}
        modelFile={modelFile}
        spotlightColor={spotlightColor}
        backgroundColor={backgroundColor}
        selectedPartColor={selectedPartColor}
        onPartSelect={handlePartSelect}
        selectedPart={selectedPart}
        className="absolute inset-0"
        spotlightPosition={spotlightPosition}
        setSpotlightPosition={setSpotlightPosition}
        showLightHelper={showLightHelper}
        spotlightIntensity={spotlightIntensity}
      />
      <div className="absolute top-4 right-4">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen} modal={false}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full shadow-lg">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Open Controls</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[350px] sm:w-[400px] p-0 flex flex-col"
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <SheetHeader className="p-6 border-b">
              <SheetTitle className="flex items-center text-xl font-headline">
                <Palette className="mr-2 h-6 w-6 text-primary" />
                3D Model Controls
              </SheetTitle>
            </SheetHeader>
            <ControlPanel
              onModelFileChange={setModelFile}
              modelFile={modelFile}
              spotlightColor={spotlightColor}
              onSpotlightColorChange={setSpotlightColor}
              backgroundColor={backgroundColor}
              onBackgroundColorChange={setBackgroundColor}
              selectedPartColor={selectedPartColor}
              onSelectedPartColorChange={setSelectedPartColor}
              selectedPartName={getSelectedPartName()}
              showLightHelper={showLightHelper}
              onShowLightHelperChange={setShowLightHelper}
              currentSpotlightPosition={spotlightPosition}
              spotlightIntensity={spotlightIntensity}
              onSpotlightIntensityChange={setSpotlightIntensity}
              exportImageScale={exportImageScale}
              onExportImageScaleChange={setExportImageScale}
              onExportImage={handleExportImage}
              onExportGLB={handleExportGLB}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
