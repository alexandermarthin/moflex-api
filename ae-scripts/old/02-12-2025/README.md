# After Effects Project Export Script - Modular Version

This is a modular version of the After Effects project export script, split into logical components for better maintainability and organization.

## File Structure

### Main Script

-   **`main-export.jsx`** - Main entry point that orchestrates the entire export process

### Module Files

-   **`utils.jsx`** - Common utilities, JSON polyfill, logging, and helper functions
-   **`shape-processors.jsx`** - Shape layer processing including groups, paths, fills, strokes, etc.
-   **`mask-processors.jsx`** - Mask processing including paths, feathering, opacity, and expansion
-   **`property-processors.jsx`** - Transform properties, text animators, and other layer properties
-   **`layer-processors.jsx`** - Different types of layers (footage, compositions, text, shape, etc.)

## How to Use

### Option 1: Use the Main Script (Recommended)

Simply run `main-export.jsx` in After Effects. It will automatically include all the necessary modules.

### Option 2: Use Individual Modules

If you need specific functionality, you can include individual modules in your own scripts:

```jsx
// Include specific modules as needed
#include "utils.jsx"
#include "shape-processors.jsx"
#include "mask-processors.jsx"
// ... etc
```

## Benefits of Modular Structure

1. **Maintainability**: Easier to fix bugs in specific areas
2. **Reusability**: Individual modules can be used in other scripts
3. **Testing**: Test individual components separately
4. **Collaboration**: Multiple people can work on different modules
5. **Debugging**: Easier to isolate issues to specific functionality
6. **Code Organization**: Logical separation of concerns

## Module Dependencies

The modules have the following dependency order:

1. `utils.jsx` - No dependencies, contains core utilities
2. `shape-processors.jsx` - Depends on `utils.jsx`
3. `mask-processors.jsx` - Depends on `utils.jsx`
4. `property-processors.jsx` - Depends on `utils.jsx`
5. `layer-processors.jsx` - Depends on all other modules
6. `main-export.jsx` - Depends on all modules

## After Effects Compatibility

This modular approach uses After Effects' `#include` directive, which is supported in:

-   After Effects CC 2014 and later
-   ExtendScript Toolkit
-   Adobe Script Runner

## File Paths

**Important**: The script contains hardcoded file paths that need to be updated for your system:

-   Log file: `/Users/lumafilm/Documents/code/system/apps/files-api/TheBucket/632ab2e9-70fb-429e-a682-a3542fcc9cd8/log.txt`
-   Output file: `/Users/lumafilm/Documents/code/system/apps/files-api/TheBucket/632ab2e9-70fb-429e-a682-a3542fcc9cd8/project.json`

Update these paths in `utils.jsx` before running the script.

## Troubleshooting

### Module Not Found Errors

Ensure all module files are in the same directory as your main script.

### Function Not Defined Errors

Check that the module dependencies are correct and that `#include` statements are in the right order.

### Path Errors

Verify that the file paths in `utils.jsx` are correct for your system.

## Adding New Features

To add new functionality:

1. Create a new module file (e.g., `new-feature.jsx`)
2. Add the `#include` statement to `main-export.jsx`
3. Implement your functions in the new module
4. Call them from the main script

## Track Matte Support

The script now exports track matte information for layers. This includes:

-   **Track Matte Mode**: "alpha", "luma", or "unknown"
-   **Inverted**: Boolean indicating if the matte is inverted
-   **Matte Layer ID**: Reference to the layer being used as the matte
-   **Matte Layer Name**: The name of the layer being used as the matte
-   **Track Matte Type**: The numeric track matte type value from After Effects

### Track Matte Types Supported

-   **Alpha Matte**: Uses the alpha channel of the layer above
-   **Alpha Inverted Matte**: Uses the inverted alpha channel of the layer above
-   **Luma Matte**: Uses the luminance of the layer above
-   **Luma Inverted Matte**: Uses the inverted luminance of the layer above

### Example Output

```json
{
    "trackMatte": {
        "mode": "alpha",
        "inverted": false,
        "matteLayerId": "comp_1_0",
        "matteLayerName": "Red Solid 2",
        "trackMatteType": 1
    }
}
```

If no track matte is applied, the `trackMatte` property will be `null`.

## Performance Notes

-   The modular structure has minimal performance impact
-   All modules are loaded at script startup
-   No runtime module loading overhead
-   Memory usage is similar to the monolithic version

## Version History

-   **v2.0** - Modular structure with separated concerns
-   **v1.0** - Original monolithic script (2000+ lines)

## Support

For issues or questions about the modular structure, check:

1. After Effects scripting documentation
2. ExtendScript reference
3. Module dependency order
4. File paths and permissions
