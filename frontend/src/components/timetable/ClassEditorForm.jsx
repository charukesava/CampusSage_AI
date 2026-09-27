import Button from "../common/Button";
import { Input, Select } from "../common/Input";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const classTypes = ["Theory", "Lab", "Tutorial"];

export default function ClassEditorForm({
  value,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <form className="cs-form-grid" onSubmit={onSubmit}>
      <Select
        label="Day"
        value={value.day}
        onChange={(event) => onChange({ ...value, day: event.target.value })}
      >
        {days.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </Select>
      <Input
        label="Start time"
        type="time"
        value={value.startTime}
        onChange={(event) =>
          onChange({ ...value, startTime: event.target.value })
        }
      />
      <Input
        label="End time"
        type="time"
        value={value.endTime}
        onChange={(event) =>
          onChange({ ...value, endTime: event.target.value })
        }
      />
      <Input
        label="Subject"
        value={value.subject}
        onChange={(event) =>
          onChange({ ...value, subject: event.target.value })
        }
      />
      <Input
        label="Room"
        value={value.room}
        onChange={(event) => onChange({ ...value, room: event.target.value })}
      />
      <Input
        label="Faculty"
        value={value.faculty}
        onChange={(event) =>
          onChange({ ...value, faculty: event.target.value })
        }
      />
      <Select
        label="Type"
        value={value.type}
        onChange={(event) => onChange({ ...value, type: event.target.value })}
      >
        {classTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Select>
      <div className="cs-form-grid__actions">
        <Button type="submit">Save class</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
