// SPDX-License-Identifier: Apache-2.0
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import javax.imageio.ImageIO;

// Convert the opaque theatre cloth at export time. The Android player receives
// its full-resolution sRGB pixels through the same PNG path as the other art.
class LanternJpeg {
    public static void main(String[] args) throws IOException {
        BufferedImage image = ImageIO.read(new File(args[0]));
        if (image == null || image.getWidth() != 960 || image.getHeight() != 540) {
            throw new IOException("Unexpected theatre cloth dimensions");
        }
        if (!ImageIO.write(image, "png", new File(args[1]))) {
            throw new IOException("Missing JDK PNG writer");
        }
    }
}
