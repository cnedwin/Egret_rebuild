// First-party named predictions frozen before the actual compiler run.
// This isolated source has no suppression and cannot cascade into valid consumers.
// GAME_CLOCK_IMPORT_CASE admission-factory TS2724
import {admitGameClockOptions} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE owner-factory TS2305
import {createGameClockOwner} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE admitted-type TS2724
import type {AdmittedGameClockOptions} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE context-type TS2305
import type {GameClockContext} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE owner-type TS2305
import type {GameClockOwner} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE clock-brand-value TS2305
import {clockBrand} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE subscription-brand-value TS2305
import {subscriptionBrand} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE no-clock-factory TS2305
import {createGameClock} from '@egret/engine';
// GAME_CLOCK_IMPORT_CASE no-runtime-port TS2305
import type {GameClock} from '@egret/runtime';
// GAME_CLOCK_IMPORT_CASE no-owner-subpath TS2307
import * as privateClock from '@egret/engine/gameClock';
void admitGameClockOptions; void createGameClockOwner; void clockBrand; void subscriptionBrand; void createGameClock; void privateClock;
