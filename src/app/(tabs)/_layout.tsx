import { NativeTabs } from 'expo-router/native-tabs';

import { C } from '@/components/shop/ui';

export default function TabLayout() {
  return (
    <NativeTabs backgroundColor={C.white} indicatorColor="#EEE8DB" labelStyle={{ selected: { color: C.teal } }}>
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
        <NativeTabs.Trigger.Label>Categories</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="bag" md="shopping_bag" />
        <NativeTabs.Trigger.Label>Cart</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="heart" md="favorite" />
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
