import { Circle } from '@uiw/react-color';
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STICKER_PALETTE, stickerColorValue } from '../utils/stickerColors';

// The background-color control in a sticker's toolbar: a palette button that opens
// the shared color picker (@uiw/react-color) over the sticky-note palette.
// Selecting a swatch calls onChange with the hex.
export default function StickerColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    // Modal so an outside click on the React Flow canvas (which captures pointer
    // events) dismisses the picker instead of being swallowed by the canvas.
    <Popover modal>
      <PopoverTrigger
        aria-label="Background color"
        title="Background color"
        className="nodrag flex size-7 cursor-pointer items-center justify-center rounded text-black/50 hover:bg-black/10 hover:text-black/80 [&_svg]:size-3.5"
      >
        <Palette />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <p className="mb-2 text-sm font-medium">Background colors</p>
        <Circle
          colors={STICKER_PALETTE}
          color={stickerColorValue(value)}
          onChange={(color) => onChange(color.hex)}
        />
      </PopoverContent>
    </Popover>
  );
}
