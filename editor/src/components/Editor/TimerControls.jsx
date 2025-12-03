import { useTimerStore } from "@/stores/timerStore";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Repeat, Repeat1, Save } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FILE_API_ENDPOINTS } from "@/lib/constants";

const TimerControls = () => {
    const { time, isRunning, startTimer, stopTimer, resetTimer, shouldLoop, setShouldLoop, setTime, fps, setFps } = useTimerStore();
    const { viewerZoom, setViewerZoom, projectId } = useEditorStore();
    const { getStoreAsJson } = useProjectStore();

    const zoomOptions = [
        { label: "25%", value: 0.25 },
        { label: "50%", value: 0.5 },
        { label: "100%", value: 1 },
    ];

    const handleSave = async () => {
        if (!projectId) {
            console.error("No projectId available for save");
            return;
        }

        try {
            const projectData = getStoreAsJson();

            const formData = new FormData();
            const blob = new Blob([projectData], { type: 'application/json' });
            formData.append('file', blob, 'project.json');
            formData.append('path', projectId);

            const response = await fetch(FILE_API_ENDPOINTS.UPLOAD, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            console.log('Project saved successfully');
        } catch (error) {
            console.error('Failed to save project:', error);
        }
    };

    return (
        <div className="timer-controls">
            <Button variant="outline" onClick={isRunning ? stopTimer : startTimer}>
                {isRunning ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button variant="outline" onClick={resetTimer}>
                <RotateCcw size={16} />
            </Button>
            <Button variant="outline" onClick={() => setShouldLoop(!shouldLoop)}>
                {shouldLoop ? <Repeat size={16} /> : <Repeat1 size={16} />}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={!projectId}>
                <Save size={16} />
            </Button>

            <label>FPS: </label>
            <input type="number" min="1" max="60" value={fps} onChange={(e) => setFps(e.target.value)} disabled={isRunning} />
            <input className="w-16" type="number" step="0.01" value={time} onChange={(e) => setTime(e.target.value)} disabled={isRunning} />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">{Math.round(viewerZoom * 100)}%</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {zoomOptions.map((option) => (
                        <DropdownMenuItem key={option.value} onClick={() => setViewerZoom(option.value)}>
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

export default TimerControls;
