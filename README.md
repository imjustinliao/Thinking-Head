# Thinking Head

A lightweight, original modular-mech status indicator for AI and agent interfaces.

The component turns five common activities into small, readable machine motions: thinking, executing, listening, searching, and reading. It uses inline SVG and CSS only—no images, downloads, server calls, or JavaScript animation loop.

```tsx
import { MechIndicator } from "thinking-head/react";

<MechIndicator state="searching" size={44} />;
```

The first implementation is under active visual review. See `docs/animation-system.md` for the pose plans and `demo/` for the local inspection showcase.

## License

[MIT](LICENSE)
