import { BoxBlurPlugin } from "./plugins/BoxBlur";
import { DirectionalBlurPlugin } from "./plugins/DirectionalBlur";

const registry = new Map();

// Map matchName -> plugin object with apply({ runner, readTex, writeRT, effect, ... })
registry.set("ADBE Box Blur2", BoxBlurPlugin);
registry.set("ADBE Motion Blur", DirectionalBlurPlugin);

export function getEffectPlugin(matchName) {
    return registry.get(matchName);
}

export default registry;
