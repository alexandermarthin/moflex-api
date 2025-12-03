import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

export default function EditableTitle({ editableTitleText, handleTitleChange }) {
    const [isEditing, setIsEditing] = useState(false);
    const [titleText, setTitleText] = useState(editableTitleText);

    const handleConfirm = () => {
        handleTitleChange(titleText);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTitleText(editableTitleText); // Reset to original text
        setIsEditing(false);
    };

    if (!isEditing) {
        return (
            <h1
                className="cursor-pointer select-none font-bold"
                onDoubleClick={() => {
                    setIsEditing(true);
                }}
            >
                {editableTitleText}
            </h1>
        );
    } else {
        return (
            <div className="flex gap-2">
                <Input
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleConfirm();
                        } else if (e.key === "Escape") {
                            handleCancel();
                        }
                    }}
                    autoFocus
                />

                <Button variant="outline" size="icon" onClick={handleCancel}>
                    <X size={16} />
                </Button>

                <Button variant="outline" size="icon" onClick={handleConfirm}>
                    <Check size={16} />
                </Button>
            </div>
        );
    }
}
