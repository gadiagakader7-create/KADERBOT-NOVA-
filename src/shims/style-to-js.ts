import StyleToObject from 'style-to-object';

const CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
const HYPHEN_REGEX = /-([a-z])/g;
const NO_HYPHEN_REGEX = /^[^-]+$/;
const VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
const MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;

const skipCamelCase = (property: string) =>
  !property ||
  NO_HYPHEN_REGEX.test(property) ||
  CUSTOM_PROPERTY_REGEX.test(property);

const capitalize = (_match: string, character: string) =>
  character.toUpperCase();

const trimHyphen = (_match: string, prefix: string) => `${prefix}-`;

export interface CamelCaseOptions {
  reactCompat?: boolean;
}

export const camelCase = (property: string, options: CamelCaseOptions = {}) => {
  if (skipCamelCase(property)) {
    return property;
  }

  property = property.toLowerCase();

  if (options.reactCompat) {
    property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
  } else {
    property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
  }

  return property.replace(HYPHEN_REGEX, capitalize);
};

export type StyleObject = Record<string, string>;

export interface StyleToJSOptions extends CamelCaseOptions {}

export function StyleToJS(style: string, options?: StyleToJSOptions): StyleObject {
  const output: StyleObject = {};

  if (!style || typeof style !== 'string') {
    return output;
  }

  StyleToObject(style, (property, value) => {
    if (property && value) {
      output[camelCase(property, options)] = value;
    }
  });

  return output;
}

(StyleToJS as any).default = StyleToJS;

export default StyleToJS;
