import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default function EditableButton({ handleEditable, isEditable }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={`w-6 h-6 text-xs ${isEditable ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
      onClick={handleEditable}
    >
      <Pencil size={14} />
    </Button>
  );
}
