import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { app, cfg } from '../firebase';

export { InferenceMode };

// Every on-device call declares English text in and out (Chrome's on-device model
// supports a fixed set of output languages and warns when none is given).
const EN = [{ type: 'text', languages: ['en'] }];

let ai = null;
const getAi = () => (ai ??= getAI(app, { backend: new GoogleAIBackend() }));

const cache = new Map();

/**
 * One GenerativeModel per (task, mode, schema, cloud model). The same JSON Schema
 * constrains the on-device output and the cloud output.
 */
export function modelFor(task, mode, schema) {
  const cloudModel = cfg.string('cloud_model');
  const key = `${task}|${mode}|${cloudModel}|${JSON.stringify(schema)}`;
  if (!cache.has(key)) {
    cache.set(key, getGenerativeModel(getAi(), {
      mode,
      onDeviceParams: {
        createOptions: { expectedInputs: EN, expectedOutputs: EN },
        promptOptions: { responseConstraint: schema },
      },
      inCloudParams: {
        model: cloudModel,
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
      },
    }));
  }
  return cache.get(key);
}

/** Chrome's Prompt API availability, checked directly so the UI can explain what will happen. */
export async function deviceAvailability() {
  const LM = globalThis.LanguageModel;
  if (!LM?.availability) return 'unsupported';
  try {
    return await LM.availability({ expectedInputs: EN, expectedOutputs: EN });
  } catch {
    return 'unavailable';
  }
}

/** Must run from a click: starts (or waits for) the on-device model download. */
export async function prepareDeviceModels(onProgress, schemas) {
  const models = schemas.map(([task, schema]) => modelFor(task, InferenceMode.ONLY_ON_DEVICE, schema));
  await models[0].initializeDeviceModel((p) => onProgress?.(p));
  await Promise.all(models.slice(1).map((m) => m.initializeDeviceModel().catch(() => {})));
}
