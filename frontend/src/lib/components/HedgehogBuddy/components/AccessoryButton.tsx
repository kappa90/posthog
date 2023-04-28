import { capitalizeFirstLetter } from 'lib/utils'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { useActions, useValues } from 'kea'
import { IconLock } from 'lib/lemon-ui/icons'
import { hedgehogbuddyLogic } from '../hedgehogbuddyLogic'
import { AccessoryInfo } from '../sprites/sprites'

export type HedgehogBuddyAccessoryProps = {
    accessory: AccessoryInfo
    accessoryKey: string
}

export function HedgehogBuddyAccessory({ accessoryKey, accessory }: HedgehogBuddyAccessoryProps): JSX.Element {
    const { accessories, availableAccessories } = useValues(hedgehogbuddyLogic)
    const { addAccessory, removeAccessory } = useActions(hedgehogbuddyLogic)

    const isUnlocked = availableAccessories.includes(accessoryKey)

    const onClick = (): void => {
        if (!accessories.includes(accessory) && isUnlocked) {
            addAccessory(accessory)
        } else {
            removeAccessory(accessory)
        }
    }

    return (
        <LemonButton
            type="secondary"
            size="small"
            onClick={onClick}
            active={accessories.includes(accessory)}
            tooltip={
                <>
                    {capitalizeFirstLetter(accessoryKey)}
                    {isUnlocked ? '' : ' (not available - can be unlocked by trying different things in PostHog...)'}
                </>
            }
        >
            {!isUnlocked && <IconLock className=" absolute right-0 top-0 rounded" />}
            <div className="relative w-8 h-8 overflow-hidden">
                <img
                    src={accessory.img}
                    // eslint-disable-next-line react/forbid-dom-props
                    style={{
                        position: 'absolute',
                        top: -(accessory.topOffset || 0),
                        left: -30,
                    }}
                />
            </div>
        </LemonButton>
    )
}
