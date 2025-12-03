// TrackMatteLayer.jsx
import MaskedLayer from "./MaskedLayer";

export default function TrackMatteLayer({
    width,
    height,
    mode = "alpha", // 'alpha' | 'luma'
    invert = false, // AE: Alpha Inverted / Luma Inverted
    children, // content (target lag)
    matte, // matte element
}) {
    console.log("TrackMatteLayer props:", { width, height, mode, invert, hasChildren: !!children, hasMatte: !!matte });

    return (
        <MaskedLayer width={width} height={height} mode={mode} invert={invert} mask={matte}>
            {children}
        </MaskedLayer>
    );
}
