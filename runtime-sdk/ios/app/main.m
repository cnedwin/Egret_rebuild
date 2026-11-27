// SPDX-License-Identifier: Apache-2.0
#import "GameHost.h"

@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic,strong) UIWindow *window;
@property (nonatomic,strong) GameHost *game;
@end
@implementation SceneDelegate
- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)options {
    if (![scene isKindOfClass:UIWindowScene.class]) return;
    self.window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
    self.game = [GameHost new];
    self.window.rootViewController = self.game;
    [self.window makeKeyAndVisible];
}
- (void)sceneDidEnterBackground:(UIScene *)scene { [self.game suspendGame]; }
- (void)sceneWillEnterForeground:(UIScene *)scene { [self.game resumeGame]; }
- (void)sceneDidDisconnect:(UIScene *)scene { [self.game closeGame]; self.game = nil; self.window = nil; }
@end

@interface AppDelegate : UIResponder <UIApplicationDelegate>
@end
@implementation AppDelegate
- (UISceneConfiguration *)application:(UIApplication *)app configurationForConnectingSceneSession:(UISceneSession *)session
                              options:(UISceneConnectionOptions *)options {
    UISceneConfiguration *config = [[UISceneConfiguration alloc] initWithName:@"Game" sessionRole:session.role];
    config.delegateClass = SceneDelegate.class;
    return config;
}
@end
int main(int argc, char **argv) {
    @autoreleasepool { return UIApplicationMain(argc,argv,nil,NSStringFromClass(AppDelegate.class)); }
}
