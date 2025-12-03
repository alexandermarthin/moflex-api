import * as THREE from "three";

function createDirectionalMaterial() {
    return new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        transparent: true,
        premultipliedAlpha: false,
        toneMapped: false,
        uniforms: {
            uInput: { value: null },
            uTexelSize: { value: new THREE.Vector2(0, 0) },
            uAngleRad: { value: 0.0 },
            uLengthPx: { value: 0.0 },
        },
        vertexShader: `
			varying vec2 vUv;
			void main(){
				vUv = position.xy * 0.5 + 0.5;
				gl_Position = vec4(position, 1.0);
			}
		`,
        fragmentShader: `
			precision highp float;
			varying vec2 vUv;
			uniform sampler2D uInput;
			uniform vec2 uTexelSize;
			uniform float uAngleRad;
			uniform float uLengthPx;

			void main(){
				float len = max(uLengthPx, 0.0);
				int taps = 32;
				if(len <= 0.5){
					gl_FragColor = texture2D(uInput, vUv);
					return;
				}
				vec2 dir = vec2(cos(uAngleRad), sin(uAngleRad));
				vec2 stepUV = dir * uTexelSize * (len / float(taps));
				vec3 sumRGB = vec3(0.0);
				float sumA = 0.0;
				for(int i=0;i<taps;i++){
					float t = (float(i) - float(taps-1) * 0.5) / float(taps-1);
					vec2 uv = vUv + stepUV * t * float(taps);
					vec4 c = texture2D(uInput, uv);
					sumRGB += c.rgb * c.a;
					sumA += c.a;
				}
				vec3 outRGB = sumA > 0.0 ? sumRGB / sumA : vec3(0.0);
				float outA = sumA / float(taps);
				gl_FragColor = vec4(outRGB, outA);
			}
		`,
    });
}

import { getValueAtTime } from "@/lib/anim-utils";

export const DirectionalBlurPlugin = {
    apply({ runner, readTex, writeRT, effect, time }) {
        // Map params, evaluate keyframes when present
        let angleDeg = 0.0;
        let lengthPx = 0.0;
        const params = effect.parameters || [];
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            const hasKeys = Array.isArray(p.keyframes) && p.keyframes.length > 0;
            if (p.matchName?.includes("0001")) {
                const v = hasKeys ? getValueAtTime(p, time) : p.value;
                angleDeg = Number(v) || 0;
            } else if (p.matchName?.includes("0002")) {
                const v = hasKeys ? getValueAtTime(p, time) : p.value;
                lengthPx = Number(v) || 0;
            }
        }
        const angleRad = (angleDeg * Math.PI) / 180.0;
        if (!this._mat) this._mat = createDirectionalMaterial();
        this._mat.uniforms.uAngleRad.value = angleRad;
        this._mat.uniforms.uLengthPx.value = lengthPx;
        return runner.renderPass(this._mat, readTex, writeRT);
    },
};

export default DirectionalBlurPlugin;
