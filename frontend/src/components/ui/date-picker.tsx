import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"

interface DatePickerProps {
  date?: Date
  setDate: (date?: Date) => void
  placeholder?: string
  className?: string
  disabled?: (date: Date) => boolean
  modifiers?: Record<string, any>
  modifiersClassNames?: Record<string, string>
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className, disabled, modifiers, modifiersClassNames }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 h-auto focus:border-indigo-500/50 transition-all outline-none overflow-hidden whitespace-normal group",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-3 h-4 w-4 text-slate-400 group-focus:text-indigo-500 transition-colors shrink-0" />
          <span className="truncate">
            {date ? format(date, "PPP") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-100" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setOpen(false);
          }}
          disabled={disabled}
          initialFocus
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
        />
      </PopoverContent>
    </Popover>
  )
}
