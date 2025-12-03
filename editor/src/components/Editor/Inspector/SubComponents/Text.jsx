import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import EditableButton from "./EditableButton";
import EditableTitle from "./EditableTitle";

export default function Text() {
    const { clips, editableFields, setEditableField, removeEditableField, updateTextValue } = useProjectStore();
    const { selectedClipId } = useEditorStore();
    const selectedClip = clips[selectedClipId];
    const [textValue, setTextValue] = useState(selectedClip.text.sourceText);
    const path = ["clips", selectedClipId, "text", "sourceText"];
    const pathKey = path.join(".");
    const [isEditable, setIsEditable] = useState(!!editableFields[pathKey]);
    const [editableTitleText, setEditableTitleText] = useState(() => {
        const existingField = editableFields[pathKey];
        return existingField ? existingField.title : "";
    });

    const type = "string";

    const handleTextChange = (e) => {
        setTextValue(e.target.value);
        // setValue(path, e.target.value);
        updateTextValue(selectedClipId, e.target.value);
    };

    const handleEditable = () => {
        if (!isEditable) {
            setIsEditable(true);
            setEditableTitleText("Name for this text");
            setEditableField(path, "Name for this text", type);
        } else {
            setIsEditable(false);
            removeEditableField(path);
        }
    };

    const handleTitleChange = (title) => {
        setEditableTitleText(title);
        setEditableField(path, title, type);
    };

    return (
        <div className="flex flex-col  mt-4">
            {isEditable && <EditableTitle editableTitleText={editableTitleText} handleTitleChange={handleTitleChange} />}

            <div className="flex">
                <Input className="h-32 " type="textarea" value={textValue} onChange={handleTextChange} />
                <EditableButton handleEditable={handleEditable} isEditable={isEditable} />
            </div>
        </div>
    );
}
