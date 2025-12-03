import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useTimerStore } from "@/stores/timerStore";
import { useEditorStore } from "@/stores/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EditableTitle from "./EditableTitle";
import EditableButton from "./EditableButton";

export default function Position({ label, property }) {
  const { clips, editableFields, setEditableField, removeEditableField, updateKeyframe, updatePropertyValue } = useProjectStore();
  const { selectedClipId } = useEditorStore();
  const [currentTime, setCurrentTime] = useState(0);

  const { time, setTime } = useTimerStore();
  const selectedClip = selectedClipId ? clips[selectedClipId] : null;

  if (!selectedClip) return null;

  const propertyData = selectedClip?.properties[property];
  const track = propertyData?.keyframes || [];
  const hasKeyframes = track.length > 0;
  const staticValue = propertyData?.value;

  const path = ["clips", selectedClipId, "properties", property, "keyframes"]
  const pathKey = path.join(".");
  const [isEditable, setIsEditable] = useState(!!editableFields[pathKey]);
  const [editableTitleText, setEditableTitleText] = useState(() => {
    const existingField = editableFields[pathKey];
    return existingField ? existingField.title : "";
  });

  const keyframeNum = track.length - 1;
  const prevKeyframe = () => {
    if (hasKeyframes && currentTime > 0) {
      setCurrentTime(currentTime - 1);
      setTime(track[currentTime - 1].time);
    }
  };
  const nextKeyframe = () => {
    if (hasKeyframes && currentTime < keyframeNum) {
      setCurrentTime(currentTime + 1);
      setTime(track[currentTime + 1].time);
      console.log(track[currentTime].time);
    }
  };

  const handleEditable = () => {
    if (!isEditable) {
      setIsEditable(true);
      setEditableTitleText("Description");
      setEditableField(path, "Description");
    } else {
      setIsEditable(false);
      removeEditableField(path);
    }
  };

  const handleTitleChange = (title) => {
    setEditableTitleText(title);
    setEditableField(path, title);
  };

  // Get the current value to display
  const currentValue = hasKeyframes ? track[currentTime]?.value : staticValue;

  return (
    <div className="flex flex-col">

      {isEditable && <EditableTitle editableTitleText={editableTitleText} handleTitleChange={handleTitleChange} />}
      <div className="flex items-center">
        {label}:
        <Input
          className="w-20"
          type="number"
          value={currentValue}
          onChange={(e) => {
            if (hasKeyframes) {
              updateKeyframe(selectedClipId, property, currentTime, Number(e.target.value))
            } else {
              updatePropertyValue(selectedClipId, property, { value: Number(e.target.value) });
            }
          }}
        />
        {hasKeyframes && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="w-3 text-xs"
              onClick={prevKeyframe}
              disabled={currentTime <= 0}
            >
              &lt;
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="w-3 text-xs"
              onClick={nextKeyframe}
              disabled={currentTime >= keyframeNum}
            >
              &gt;
            </Button>
          </>
        )}
        <EditableButton handleEditable={handleEditable} isEditable={isEditable} />
      </div>
    </div>
  );
}
