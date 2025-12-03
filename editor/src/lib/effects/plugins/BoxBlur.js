import * as THREE from "three";

function createBlurPassMaterial({ axis }) {
    return new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        transparent: true,
        premultipliedAlpha: false,
        toneMapped: false,
        uniforms: {
            uInput: { value: null },
            uTexelSize: { value: new THREE.Vector2(0, 0) },
            uRadiusPx: { value: 0.0 },
            uEdgeExtend: { value: 0 },
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
			uniform float uRadiusPx;
			uniform int uEdgeExtend;

			vec4 sampleClamped(sampler2D tex, vec2 uv){
				if(uEdgeExtend==1){
					vec2 suv = clamp(uv, vec2(0.0), vec2(1.0));
					return texture2D(tex, suv);
				}
				return texture2D(tex, uv);
			}

			void main(){
				float radius = max(uRadiusPx, 0.0);
				int r = int(floor(radius + 0.5));
				if(r <= 0){
					gl_FragColor = texture2D(uInput, vUv);
					return;
				}
				vec3 sumRGB = vec3(0.0);
				float sumA = 0.0;
				int count = 0;
				for(int i=-64;i<=64;i++){
					if(i < -r) continue;
					if(i >  r) break;
					vec2 offset = vec2(${axis === "x" ? "float(i) * uTexelSize.x" : "0.0"}, ${axis === "y" ? "float(i) * uTexelSize.y" : "0.0"});
					vec4 c = sampleClamped(uInput, vUv + offset);
					sumRGB += c.rgb * c.a;
					sumA += c.a;
					count++;
				}
				vec3 outRGB = sumA > 0.0 ? sumRGB / sumA : vec3(0.0);
				float outA = sumA / float(count);
				gl_FragColor = vec4(outRGB, outA);
			}
		`,
    });
}

export const BoxBlurPlugin = {
    apply({ runner, readTex, writeRT, effect }) {
        // Map parameters
        let radiusPx = 0;
        let iterations = 1;
        let dims = 1; // 1: XY, 2: X, 3: Y (fallback)
        let edgeExtend = 0;
        const params = effect.parameters || [];
        for (let i = 0; i < params.length; i++) {
            const p = params[i];
            if (p.matchName?.includes("0001")) radiusPx = p.value || 0;
            else if (p.matchName?.includes("0002")) iterations = Math.max(1, Math.min(3, p.value || 1));
            else if (p.matchName?.includes("0003")) dims = p.value || 1; // 1 XY, 2 X, 3 Y (treat anything else conservatively)
            else if (p.matchName?.includes("0004")) edgeExtend = p.value ? 1 : 0;
        }

        // Create materials lazily and cache on plugin instance
        if (!this._matH) this._matH = createBlurPassMaterial({ axis: "x" });
        if (!this._matV) this._matV = createBlurPassMaterial({ axis: "y" });
        this._matH.uniforms.uRadiusPx.value = radiusPx;
        this._matV.uniforms.uRadiusPx.value = radiusPx;
        this._matH.uniforms.uEdgeExtend.value = edgeExtend;
        this._matV.uniforms.uEdgeExtend.value = edgeExtend;

        let src = readTex;
        let dst = writeRT;
        for (let it = 0; it < iterations; it++) {
            if (dims === 1 || dims === 2) {
                // Horizontal
                src = runner.renderPass(this._matH, src, dst);
                dst = dst === runner.ping ? runner.pong : runner.ping;
            }
            if (dims === 1 || dims === 3) {
                // Vertical
                src = runner.renderPass(this._matV, src, dst);
                dst = dst === runner.ping ? runner.pong : runner.ping;
            }
        }
        return src;
    },
};

export default BoxBlurPlugin;
