/**
 * The look shared by every single-line control (input, select trigger, combobox trigger, date and number inputs):
 * Comfortable touch size, sunken surface, strong border, visible focus, red on `aria-invalid`.
 */
export const controlClass =
  'min-h-11 w-full min-w-0 rounded border border-border-strong bg-surface-sunken px-3 text-sm text-text outline-none ' +
  'transition-[color,border-color,box-shadow] duration-(--dur) placeholder:text-text-3 ' +
  'hover:border-text-disabled focus-visible:border-focus focus-visible:text-text focus-visible:ring-1 focus-visible:ring-focus ' +
  'aria-invalid:border-zone-red aria-invalid:ring-1 aria-invalid:ring-zone-red ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

/** Floating surface (select, menu, combobox, popover, calendar popup). */
export const popupClass =
  'z-50 overflow-hidden rounded border border-border-strong bg-popover text-popover-foreground shadow-2 outline-hidden ' +
  'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 ' +
  'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0';

/** A comfortable menu row with a clear keyboard and selected state. */
export const itemClass =
  "relative flex min-h-11 w-full cursor-default items-center gap-3 rounded px-3 text-sm text-text-2 outline-hidden select-none focus:bg-hover focus:text-text data-[selected=true]:bg-hover data-[selected=true]:text-text data-disabled:pointer-events-none data-disabled:text-text-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
