# Adding experiment code - Docs

Once you've created your experiment in PostHog, the next step is to add your code.

## Fetch the feature flag

In your experiment, each user is randomly assigned to a variant (usually either 'control' or 'test'). To check which variant a user has been assigned to, fetch the experiment feature flag. You can then customize their experience based on the value in the feature flag:

**Only flag value access counts as an exposure**

You must use `getFeatureFlag()` (or its framework equivalent like `useFeatureFlagVariantKey()`) to check variants. In server-side SDKs, use the `evaluateFlags` API to access flag values via `getFlag()` / `get_flag()`. Other methods like `getAllFlags()`, `getFeatureFlags()`, or payload-only accessors do **not** record an [exposure event](/docs/experiments/exposures.md). Users evaluated with those methods won't be included in your experiment results.

PostHog AI

### Web

```javascript
// Ensure flags are loaded before usage.
// You only need to call this on the code the first time a user visits.
// See this doc for more details: /docs/feature-flags/manual#ensuring-flags-are-loaded-before-usage
posthog.onFeatureFlags(function() {
    // feature flags should be available at this point
    if (posthog.getFeatureFlag('experiment-feature-flag-key')  == 'variant-name') {
        // do something
    }
})
// Otherwise, you can just do:
if (posthog.getFeatureFlag('experiment-feature-flag-key')  == 'variant-name') {
    // do something
}
// You can also test your code by overriding the feature flag:
// e.g., posthog.featureFlags.overrideFeatureFlags({ flags: {'experiment-feature-flag-key': 'test'}})
```

### React

```jsx
// You can either use the `useFeatureFlagVariantKey` hook,
// or you can use the feature flags component - /docs/libraries/react#feature-flags-react-component
// Method one: using the useFeatureFlagVariantKey hook
import { useFeatureFlagVariantKey } from '@posthog/react'
function App() {
    const variant = useFeatureFlagVariantKey('experiment-feature-flag-key')
    if (variant == 'variant-name') {
        // do something
    }
}
// Method two: using the feature flags component
import { PostHogFeature } from '@posthog/react'
function App() {
    return (
        <PostHogFeature flag='experiment-feature-flag-key' match={'variant-name'}>
            <div>
                <!-- the component to show -->
            </div>
        </PostHogFeature>
    )
}
// You can also test your code by overriding the feature flag:
// e.g., posthog.featureFlags.overrideFeatureFlags({ flags: {'experiment-feature-flag-key': 'test'}})
```

### React Native

```jsx
// With the useFeatureFlag hook
import { useFeatureFlag } from 'posthog-react-native'
const MyComponent = () => {
    const variant = useFeatureFlag('experiment-feature-flag-key')
    if (variant === undefined) {
        // the response is undefined if the flags are being loaded
        return null
    }
    if (variant == 'variant-name') {
        // do something
    }
}
```

### Android

```kotlin
if (PostHog.getFeatureFlag("experiment-feature-flag-key")  == "variant-name") {
    // do something
}
```

### iOS

```swift
if (PostHogSDK.shared.getFeatureFlag("experiment-feature-flag-key") as? String == "variant-name") {
    // do something
}
```

### Node.js

```javascript
const flags = await client.evaluateFlags('user_distinct_id')
const variant = flags.getFlag('experiment-feature-flag-key')
if (variant === 'variant-name') {
    // Do something
}
```

### Python

```python
flags = posthog.evaluate_flags("user_distinct_id")
variant = flags.get_flag("experiment-feature-flag-key")
if variant == "variant-name":
    # Do something
```

### PHP

```php
$flags = PostHog::evaluateFlags('user_distinct_id');
$variant = $flags->getFlag('experiment-feature-flag-key');
if ($variant === 'variant-name') {
    // Do something differently for this user
}
```

### Ruby

```ruby
flags = posthog.evaluate_flags('user_distinct_id')
variant = flags.get_flag('experiment-feature-flag-key')
if variant == 'variant-name'
    # Do something
end
```

### Go

```go
flags, err := client.EvaluateFlags(posthog.EvaluateFlagsPayload{
    DistinctId: "user_distinct_id",
})
if err != nil {
    // Handle error (e.g. capture error and fallback to default behavior)
}
variant := flags.GetFlag("experiment-feature-flag-key")
if variant == "variant-name" {
    // Do something
}
```

### Elixir

```elixir
{:ok, snapshot} = PostHog.FeatureFlags.evaluate_flags("user_distinct_id")
variant = PostHog.FeatureFlags.Evaluations.get_flag(snapshot, "experiment-feature-flag-key")
if variant == "variant-name" do
  # Do something
end
```

### Java

```java
PostHogFeatureFlagEvaluations flags = posthog.evaluateFlags("user_distinct_id");
Object flagValue = flags.getFlag("experiment-feature-flag-key");
String variant = flagValue instanceof String ? (String) flagValue : "control";
if ("variant-name".equals(variant)) {
    // Do something
}
```

### dotnet

```dotnet
var flags = await posthog.EvaluateFlagsAsync("user_distinct_id");
var variant = flags.GetFlag("experiment-feature-flag-key")?.VariantKey;
if (variant == "variant-name")
{
    // Do something
}
```

> To run an experiment using our API (without any SDK), see our docs on [how to run experiments without feature flags](/docs/experiments/running-experiments-without-feature-flags.md).

### Community questions

Ask a question

### Was this page useful?

HelpfulCould be better