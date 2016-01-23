// Type definitions for text-encoding
// Project: https://github.com/inexorabletash/text-encoding

// Node require() friendly defintions, based on the ambient definitions from MIZUNE Pine <https://github.com/pine613/>
// and https://github.com/borisyankov/DefinitelyTyped

// See the polyfill: https://github.com/inexorabletash/text-encoding

declare module TextEncoding {

    interface TextEncodingStatic {
        TextDecoder: {
            (label?: string, options?: TextDecoderOptions): TextDecoder;
            new (label?: string, options?: TextDecoderOptions): TextDecoder;
        };

        TextEncoder: {
            (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
            new (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
        };

    }

    interface TextDecoderOptions {
        fatal?: boolean;
        ignoreBOM?: boolean;
    }

    interface TextDecodeOptions {
        stream?: boolean;
    }

    interface TextEncoderOptions {
        NONSTANDARD_allowLegacyEncoding?: boolean;
    }

    interface TextDecoder {
        encoding: string;
        fatal: boolean;
        ignoreBOM: boolean;
        decode(input?: ArrayBufferView, options?: TextDecodeOptions): string;
    }

    interface TextEncoder {
        encoding: string;
        encode(input?: string, options?: TextEncodeOptions): Uint8Array;
    }

    interface TextEncodeOptions {
        stream?: boolean;
    }
}


declare module "text-encoding" {
  var TextEncodingStatic:TextEncoding.TextEncodingStatic;
  export = TextEncodingStatic;
}
