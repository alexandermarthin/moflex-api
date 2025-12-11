// TrackMatteLayer.jsx
import MaskedLayer from "./MaskedLayer";

export default function TrackMatteLayer({
    width, // comp width (for backward compatibility)
    height, // comp height (for backward compatibility)
    compWidth, // preferred: explicit comp width
    compHeight, // preferred: explicit comp height
    mode = "alpha", // 'alpha' | 'luma'
    invert = false, // AE: Alpha Inverted / Luma Inverted
    children, // content (target layer) - already has transforms applied
    matte, // matte element - already has transforms applied
}) {
    // Use explicit comp dimensions if provided, otherwise fall back to width/height
    const finalCompWidth = compWidth || width;
    const finalCompHeight = compHeight || height;

    // For track mattes, the children and matte elements already have their own transforms
    // applied (they come from renderClipEl which renders full layer components).
    // We don't pass a transform to MaskedLayer - the content handles its own positioning.
    return (
        <MaskedLayer compWidth={finalCompWidth} compHeight={finalCompHeight} width={finalCompWidth} height={finalCompHeight} mode={mode} invert={invert} mask={matte}>
            {children}
        </MaskedLayer>
    );
}
