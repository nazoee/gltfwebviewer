
"use client";

import React, { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UploadCloud, Lightbulb, ImageIcon as BackgroundIcon, Brush, Eye, Camera, Download, Zap } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface ControlPanelProps {
  onModelFileChange: (file: File | null) => void;
  spotlightColor: string;
  onSpotlightColorChange: (color: string) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  selectedPartColor: string;
  onSelectedPartColorChange: (color: string) => void;
  selectedPartName: string | null;
  modelFile: File | null;
  showLightHelper: boolean;
  onShowLightHelperChange: (checked: boolean) => void;
  currentSpotlightPosition: { x: number; y: number; z: number };
  spotlightIntensity: number;
  onSpotlightIntensityChange: (intensity: number) => void;
  exportImageScale: number;
  onExportImageScaleChange: (scale: number) => void;
  onExportImage: () => void;
  onExportGLB: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onModelFileChange,
  spotlightColor,
  onSpotlightColorChange,
  backgroundColor,
  onBackgroundColorChange,
  selectedPartColor,
  onSelectedPartColorChange,
  selectedPartName,
  modelFile,
  showLightHelper,
  onShowLightHelperChange,
  currentSpotlightPosition,
  spotlightIntensity,
  onSpotlightIntensityChange,
  exportImageScale,
  onExportImageScaleChange,
  onExportImage,
  onExportGLB,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onModelFileChange(event.target.files[0]);
    } else {
      onModelFileChange(null);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleRemoveModel = () => {
    onModelFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  return (
    <Card className="flex-1 shadow-none rounded-none border-0 flex flex-col overflow-hidden">
      <CardContent className="p-6 space-y-6 flex-grow overflow-y-auto">
        <div className="space-y-3">
          <Label htmlFor="model-upload" className="text-base font-medium flex items-center">
            <UploadCloud className="mr-2 h-5 w-5 text-primary" /> Model (GLB/GLTF)
          </Label>
          <Input
            id="model-upload"
            type="file"
            accept=".glb,.gltf"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
          <Button onClick={handleBrowseClick} variant="outline" className="w-full">
            {modelFile ? `Loaded: ${modelFile.name.substring(0,20)}...` : 'Browse File'}
          </Button>
           {modelFile && (
            <Button onClick={handleRemoveModel} variant="destructive" className="w-full mt-2">
              Remove Model
            </Button>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center">
            <Lightbulb className="mr-2 h-5 w-5 text-primary" /> Spotlight
          </Label>
          <div className="space-y-2">
            <Label htmlFor="spotlight-color" className="text-sm">Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="spotlight-color"
                type="color"
                value={spotlightColor}
                onChange={(e) => onSpotlightColorChange(e.target.value)}
                className="w-16 h-10 p-1 rounded-md border cursor-pointer"
              />
              <Input
                type="text"
                value={spotlightColor}
                onChange={(e) => onSpotlightColorChange(e.target.value)}
                className="flex-1"
                aria-label="Spotlight color hex value"
              />
            </div>
          </div>
           <div className="space-y-2 mt-3">
            <Label htmlFor="spotlight-intensity" className="text-sm flex items-center">
              <Zap className="mr-2 h-4 w-4" /> Intensity: {spotlightIntensity.toFixed(1)}
            </Label>
            <Slider
              id="spotlight-intensity"
              min={0}
              max={50} 
              step={0.5}
              value={[spotlightIntensity]}
              onValueChange={(value) => onSpotlightIntensityChange(value[0])}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <Label htmlFor="show-light-helper" className="text-sm flex items-center">
              <Eye className="mr-2 h-4 w-4" /> Show & Drag Light
            </Label>
            <Switch
              id="show-light-helper"
              checked={showLightHelper}
              onCheckedChange={onShowLightHelperChange}
            />
          </div>
          {showLightHelper && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Position (draggable in viewer):</p>
              <p>X: {currentSpotlightPosition.x.toFixed(2)}, Y: {currentSpotlightPosition.y.toFixed(2)}, Z: {currentSpotlightPosition.z.toFixed(2)}</p>
            </div>
          )}
        </div>
        
        <Separator />

        <div className="space-y-3">
          <Label htmlFor="background-color" className="text-base font-medium flex items-center">
            <BackgroundIcon className="mr-2 h-5 w-5 text-primary" /> Background Color
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="background-color"
              type="color"
              value={backgroundColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              className="w-16 h-10 p-1 rounded-md border cursor-pointer"
            />
             <Input
              type="text"
              value={backgroundColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              className="flex-1"
              aria-label="Background color hex value"
            />
          </div>
        </div>

        <Separator />
        
        <div className="space-y-3">
          <Label htmlFor="part-color" className="text-base font-medium flex items-center">
            <Brush className="mr-2 h-5 w-5 text-primary" /> Selected Part Color
          </Label>
          {selectedPartName ? (
            <>
              <p className="text-sm text-muted-foreground">Part: <span className="font-semibold text-foreground">{selectedPartName}</span></p>
              <div className="flex items-center gap-2">
                <Input
                  id="part-color"
                  type="color"
                  value={selectedPartColor}
                  onChange={(e) => onSelectedPartColorChange(e.target.value)}
                  className="w-16 h-10 p-1 rounded-md border cursor-pointer"
                  disabled={!selectedPartName || selectedPartName === "None"}
                />
                <Input
                  type="text"
                  value={selectedPartColor}
                  onChange={(e) => onSelectedPartColorChange(e.target.value)}
                  className="flex-1"
                  disabled={!selectedPartName || selectedPartName === "None"}
                  aria-label="Selected part color hex value"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Click on a model part in the viewer to select it and change its color.</p>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
           <Label className="text-base font-medium flex items-center">
            <Download className="mr-2 h-5 w-5 text-primary" /> Export Options
          </Label>
          <div className="space-y-2">
            <Label htmlFor="export-image-scale" className="text-sm">Rendered Image Scale</Label>
            <Select value={String(exportImageScale)} onValueChange={(value) => onExportImageScaleChange(Number(value))}>
              <SelectTrigger id="export-image-scale">
                <SelectValue placeholder="Select scale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x (Current)</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="3">3x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onExportImage} variant="outline" className="w-full flex items-center gap-2 mt-2">
            <Camera className="h-4 w-4" /> Export Rendered Image
          </Button>
          <Button onClick={onExportGLB} variant="outline" className="w-full flex items-center gap-2" disabled={!modelFile}>
            <Download className="h-4 w-4" /> Export Model (GLB)
          </Button>
        </div>

      </CardContent>
    </Card>
  );
};

export default ControlPanel;
