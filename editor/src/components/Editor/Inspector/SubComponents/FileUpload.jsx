import { useState } from "react";
import FileUploadComponent from "./FileUploadComponent";
import EditableButton from "./EditableButton";
import EditableTitle from "./EditableTitle";
import { useProjectStore } from "@/stores/projectStore";

export default function FileUpload({ assetId }) {
    const { assets, clips, selectedClipId, setValue, editableFields, setEditableField, removeEditableField } = useProjectStore();
    const path = ["assets", assetId, "url"];
    const pathKey = path.join(".");

    const [isEditable, setIsEditable] = useState(!!editableFields[pathKey]);
    const [editableTitleText, setEditableTitleText] = useState(() => {
        const existingField = editableFields[pathKey];
        return existingField ? existingField.title : "";
    });

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

    return (
        <div className="flex flex-col  mt-4">
            {isEditable && <EditableTitle editableTitleText={editableTitleText} handleTitleChange={handleTitleChange} />}
            <div className="flex">
                {/* <FileUploadComponent initialFile={existingFile} mode="image" assetId={assetId} /> */}
                <FileUploadComponent mode={assets[assetId].type} assetId={assetId} />
                <EditableButton handleEditable={handleEditable} isEditable={isEditable} />
            </div>
        </div>
    );
}
