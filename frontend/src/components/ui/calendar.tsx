import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-6",
        month_caption: "flex justify-center pt-1 relative items-center mb-6 h-9",
        caption_label: "text-sm font-black text-slate-900 tracking-tight",
        nav: "absolute inset-x-0 flex items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-white p-0 opacity-60 hover:opacity-100 shadow-sm border-slate-200 z-10 rounded-lg transition-all active:scale-95"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-white p-0 opacity-60 hover:opacity-100 shadow-sm border-slate-200 z-10 rounded-lg transition-all active:scale-95"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex justify-between mb-4",
        weekday: "text-slate-400 rounded-md w-9 font-black text-[9px] uppercase tracking-[0.2em] text-center",
        week: "flex w-full mt-2 justify-between",
        day: "h-10 w-10 p-0 flex items-center justify-center relative",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-bold transition-all hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-sm"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected: "[&_button]:bg-indigo-600! [&_button]:text-white! [&_button]:shadow-lg [&_button]:shadow-indigo-600/30 [&_button]:ring-2 [&_button]:ring-indigo-600/10",
        today: "[&_button]:bg-slate-50 [&_button]:text-indigo-600 [&_button]:font-black after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-indigo-600 after:rounded-full after:z-10",
        outside:
          "day-outside text-slate-200 opacity-50 aria-selected:bg-indigo-50/50 aria-selected:text-slate-200 aria-selected:opacity-30",
        disabled: "text-slate-200 opacity-50",
        range_middle:
          "aria-selected:bg-slate-100 aria-selected:text-slate-900",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => props.orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
