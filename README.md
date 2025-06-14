[![[8. Attachments/6cdddeef521829eeb96122de899a1c9e_MD5.svg]]](https://github.com/mcndt/obsidian-toggl-integration/releases) ![[8. Attachments/79fe68951f8f34666d264f61c376fa76_MD5.svg]]

# Toggl Track Integration for Obsidian

Add integration with the Toggl Track API to manage your timers inside Obsidian.

## Functionality

- ✨ **NEW**: **Generate time tracking reports inside of your notes with code blocks**
- See your current timer and how long it has been running in the status bar
- Get a summary of your day in the side panel
- Create, start, and stop a new timer using the command palette, or restart an recent one

![[8. Attachments/3e1145e236de0d05591e06e1c34703cf_MD5.gif]]

## Rendering time reports inside your notes

Using simple code blocks it is possible to render time tracking reports inside your Obsidian notes. For example,

````
```toggl
SUMMARY
PAST 7 DAYS
```
````

Will result in something like:

![[8. Attachments/37242207f66338ffc8f01cfcffbd315c_MD5.png]]

You can find a full tutorial and reference on rendering time reports in the [plugin wiki](<https://github.com/mcndt/obsidian-toggl-integration/wiki/Toggl-Query-Language-(TQL)-Reference>).

## Setup

Configuring this plugin requires you to first request an API token from Toggl. More info on how to do this [can be found here](https://support.toggl.com/en/articles/3116844-where-is-my-api-token-located).

To set up this plugin, simply enter your API token in the settings tab, click connect and select the Toggl Workspace you wish to use.

![[8. Attachments/25ade342b364c59727c60573a3cab4fd_MD5.png]]

## Use with other plugins:

### QuickAdd

The developer of the QuickAdd plugin has created a preset menu for timers using QuickAdd. Instructions are available [here](https://github.com/chhoumann/quickadd/blob/master/docs/docs/Examples/Macro_TogglManager.md) and you can find out how he did it on the Obsidian Discord server ([link to message](https://discord.com/channels/686053708261228577/707816848615407697/876069796553293835)).

## Roadmap

You can see my more detailed roadmap for this plugin on this page: [Development Roadmap](https://github.com/mcndt/obsidian-toggl-integration/projects/1). I try to keep the cards in each column sorted by priority.

## Feature Requests

Please make feature requests in the GitHub discussions tab: [click here](https://github.com/mcndt/obsidian-toggl-integration/discussions/categories/feature-requests)

If you would to like to talk about the plugin with me more directly, you can find me in the Obsidian Discord server as `Maximio#6460`. Feel free to tag me!

## Dependencies

Currently I rely on this repo for providing a JavaScript interface with the Toggl Track API: https://github.com/saintedlama/toggl-client

However in the future I might write fork this so I can refactor it to use mobile friendly APIs (e.g. using Obsidian’s own request API).

## Support

If you like this plugin and want to support me, you can do so via _Buy me a Coffee_:

<a href="https://www.buymeacoffee.com/mcndt"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=mcndt&button_colour=5F7FFF&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"></a>
